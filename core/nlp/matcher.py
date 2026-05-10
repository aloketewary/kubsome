"""
Intent Matcher — classifies user queries into
operational intents using fuzzy matching and regex.

Architecture:
  User Query → Intent Classification → Entity Extraction → Action
"""

import re
from rapidfuzz import fuzz, process

from core.nlp.intents import INTENTS

# Raw regex patterns
_REGEX_INTENTS_RAW = {
    "scale": [
        r"scale (\S+) to (\d+)",
        r"set (\S+) replicas? to (\d+)",
    ],
    "logs": [
        (
            r"(?:show|get|view)?\s*(?:me\s+)?(?:the\s+)?logs?\s+"
            r"(?:for\s+|of\s+)?(\S+)"
        ),
    ],
    "restart": [
        r"restart\s+(?:the\s+)?(\S+)",
    ],
    "rollback": [
        r"(?:rollback|undo|revert)\s+(?:the\s+)?(\S+)",
    ],
    "show_pods": [
        r"(?:show|list|get)\s+(?:all\s+)?pods?",
    ],
    "events": [
        r"(?:show|list|get)\s+(?:all\s+)?events?",
    ],
    "show_nodes": [
        r"(?:show|list|get)\s+(?:all\s+)?nodes?",
    ],
    "show_services": [
        r"(?:show|list|get)\s+(?:all\s+)?services?",
    ],
    "top_pods": [
        r"(?:show|get)?\s*(?:top|resource|usage)\s*pods?",
    ],
    "top_nodes": [
        r"(?:show|get)?\s*(?:top|resource|usage)\s*nodes?",
    ],
    "inspect": [
        r"(?:show|describe|inspect|look at)\s+(?:the\s+)?(?:pod\s+)?(\S+)",
    ],
    "switch_context": [
        r"(?:switch|change|use)\s+(?:to\s+)?(?:context\s+)?(\S+)",
    ],
    "use_namespace": [
        r"(?:switch|change|use)\s+namespace\s+(\S+)",
    ],
    "diagnose": [
        r"(?:diagnose|debug|troubleshoot)\s+(?:the\s+)?(\S+)",
    ],
    "describe": [
        (
            r"(?:describe|details? (?:of|for))\s+"
            r"(?:pod\s+|deploy(?:ment)?\s+)?(\S+)"
        ),
    ],
    "delete": [
        r"(?:delete|remove|kill)\s+(?:pod\s+)?(\S+)",
    ],
    "exec": [
        r"(?:exec|shell|ssh)\s+(?:into\s+)?(?:pod\s+)?(\S+)",
    ],
    "port_forward": [
        r"(?:forward|port.?forward)\s+(\S+)\s+(?:port\s+)?(\d+)",
    ],
    "security": [
        r"(?:run|show)?\s*(?:security|scan|vulnerabilit)",
    ],
    "optimize": [
        r"(?:optimize|right.?size|cost|savings)",
    ],
    "unused": [
        r"(?:unused|orphan|cleanup|clean up|find unused)",
    ],
    "overview": [
        r"(?:overview|dashboard|cluster|health)",
    ],
    "trace": [
        r"trace\s+(?:the\s+)?(\S+)",
    ],
}

# Compiled regex for performance
REGEX_INTENTS = {
    intent: [re.compile(p) for p in patterns]
    for intent, patterns in _REGEX_INTENTS_RAW.items()
}

# Module-level constants for performance
PRIORITY_CHECK = [
    ("unhealthy", "unhealthy"),
    ("how many", "count_pods"),
    ("count ", "count_pods"),
    ("number of", "count_pods"),
    ("is it safe", "is_safe"),
    ("safe to", "is_safe"),
    ("what changed", "what_changed"),
    ("anomal", "anomalies"),
    ("why is", "why_failing"),
    ("why ", "why_failing"),
    ("is ", "health_check"),
]

_CONTEXTUAL_PRONOUNS_LIST = [
    "it", "this", "that", "the pod", "the deployment", "the service"
]
CONTEXTUAL_PRONOUNS = sorted(
    _CONTEXTUAL_PRONOUNS_LIST,
    key=len, reverse=True
)

SKIP_WORDS = {
    "why", "is", "the", "my", "a", "an",
    "show", "get", "list", "me", "all",
    "pod", "pods", "deployment", "deploy", "deployments",
    "service", "svc", "services", "node", "nodes",
    "please", "can", "you", "what",
    "how", "many", "which", "are",
    "failing", "crashing", "running",
    "healthy", "unhealthy", "down",
    "broken", "stuck", "pending",
    "restarting", "consuming", "consumes",
    "more", "cpu", "memory", "oom",
    "safely", "safe", "to", "in", "last", "hour",
    "high", "restart", "restarts", "matching",
    "resource", "consumers", "hog", "usage", "pods",
    "anomalies", "detected", "any", "changes", "recently",
    "happened",
}

# Pre-compiled regex for extraction
GENERAL_ENTITY_RE = [
    re.compile(
        r"(?:why is|diagnose|inspect|trace|"
        r"restart|rollback|logs for|logs of|"
        r"logs|describe|check|health of|"
        r"status of|exec|shell into|"
        r"delete|netcheck)\s+(?:the\s+)?"
        r"(?:pod\s+|deploy\s+)?"
        r"([a-z0-9\-\.]+)"
    )
]

RESOURCE_NAME_RE = re.compile(r"^[a-z0-9\-\.]+$")
_COUNT_PODS_PAT = (
    r"(?:how many|count|number of)\s+"
    r"(?:pods? matching\s+)?([a-z0-9\-\.]+)"
)
COUNT_PODS_RE = re.compile(_COUNT_PODS_PAT)
IS_SAFE_RE = re.compile(r"safe to (\w+)\s+(\S+)")

# Flattened intents for faster fuzzy matching
FLATTENED_INTENTS = []
for intent, phrases in INTENTS.items():
    for phrase in phrases:
        FLATTENED_INTENTS.append((phrase, intent))

FLATTENED_PHRASES = [x[0] for x in FLATTENED_INTENTS]


def detect_intent(query):
    """
    Classify a natural language query into an intent.
    Returns (intent_name, confidence_score) or (None, 0).
    """
    lower = query.lower().strip()

    # 1. Regex Matchers (Fast & High Confidence)
    for intent, patterns in REGEX_INTENTS.items():
        for pattern in patterns:
            if pattern.match(lower):
                return intent, 100

    # 2. Priority keyword checks (Exact intent signals)
    for keyword, intent in PRIORITY_CHECK:
        if keyword in lower:
            return intent, 95

    # 3. Fuzzy Matching (Fallback)
    # Optimization: Use flattened phrases for a single process call.
    # We check top 3 matches to preserve substring boost logic.
    results = process.extract(
        lower,
        FLATTENED_PHRASES,
        scorer=fuzz.token_sort_ratio,
        limit=3
    )

    if not results:
        return None, 0

    best_intent = None
    best_score = 0

    for phrase, score, index in results:
        # Check for substring boost (heuristic from original logic)
        if phrase in lower:
            score = max(score, 90)

        if score > best_score:
            best_score = score
            best_intent = FLATTENED_INTENTS[index][1]

    if best_score < 55:
        return None, 0

    return best_intent, best_score


def extract_entities(query, intent):
    """
    Extract target entities from a query given its intent.
    Returns dict with extracted fields.
    """
    from core.context import context
    lower = query.lower().strip().rstrip("?")
    entities = {}

    # Handle pronouns/contextual references
    for pronoun in CONTEXTUAL_PRONOUNS:
        if pronoun in lower and context.last_target:
            entities["target"] = context.last_target
            # Replace the pronoun in lower
            lower = lower.replace(pronoun, context.last_target)
            break

    # 1. Try extracting from Regex first (most accurate)
    if intent in REGEX_INTENTS:
        for pattern in REGEX_INTENTS[intent]:
            m = pattern.match(lower)
            if m:
                if intent == "scale":
                    entities["target"] = m.group(1)
                    entities["replicas"] = int(m.group(2))
                elif intent == "port_forward":
                    entities["target"] = m.group(1)
                    entities["port"] = m.group(2)
                elif intent == "use_namespace":
                    entities["namespace"] = m.group(1)
                elif intent == "switch_context":
                    entities["context"] = m.group(1)
                elif m.groups():
                    entities["target"] = m.group(1)
                return entities

    # 2. Fallback to general extraction logic
    tokens = [t.strip("?.,!") for t in lower.split()]

    if intent in (
        "diagnose", "inspect", "trace",
        "logs", "restart", "rollback",
        "rollout", "netcheck", "delete",
        "exec", "health_check", "why_failing", "describe",
    ):
        # Specific patterns to ignore common adjectives used as targets
        if intent == "diagnose" and ("restart" in tokens or "high" in tokens):
            # This is handled as a general high-restart check in the AI engine
            return entities

        # Look after key phrases with regex
        for p in GENERAL_ENTITY_RE:
            m = p.search(lower)
            if m:
                candidate = m.group(1).strip("?.,!")
                if candidate not in SKIP_WORDS:
                    entities["target"] = candidate
                    return entities

        # Target: first non-skip word that looks like a resource name
        for token in tokens:
            if token not in SKIP_WORDS and len(token) > 1:
                # Basic check for kubernetes resource name format
                if RESOURCE_NAME_RE.match(token):
                    # Final check: don't pick 'high' or 'restart'
                    if token in {"high", "restart"}:
                        continue
                    entities["target"] = token
                    break

    elif intent == "count_pods":
        m = COUNT_PODS_RE.search(lower)
        if m:
            candidate = m.group(1).strip("?.,!")
            if candidate not in SKIP_WORDS:
                entities["target"] = candidate

    elif intent == "is_safe":
        m = IS_SAFE_RE.search(lower)
        if m:
            entities["action"] = m.group(1)
            entities["target"] = m.group(2)

    return entities


def parse_query(query):
    """
    Full NLP pipeline: intent + entities.
    Returns structured command dict or None.
    """
    intent, score = detect_intent(query)

    if not intent:
        return None

    entities = extract_entities(query, intent)

    return {
        "intent": intent,
        "score": score,
        "entities": entities,
        "raw_query": query,
    }
