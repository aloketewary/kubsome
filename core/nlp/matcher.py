"""
Intent Matcher — classifies user queries into
operational intents using fuzzy matching.

Architecture:
  User Query → Intent Classification → Entity Extraction → Action
"""

from rapidfuzz import fuzz

from core.nlp.intents import INTENTS


def detect_intent(query):
    """
    Classify a natural language query into an intent.
    Returns (intent_name, confidence_score) or (None, 0).
    """
    lower = query.lower().strip()

    # Priority keyword checks (exact intent signals)
    priority = [
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
    ]
    for keyword, intent in priority:
        if keyword in lower:
            return intent, 95

    best_intent = None
    best_score = 0

    for intent, phrases in INTENTS.items():
        for phrase in phrases:
            score = fuzz.token_sort_ratio(
                lower, phrase
            )
            if phrase in lower:
                score = max(score, 90)

            if score > best_score:
                best_score = score
                best_intent = intent

    if best_score < 55:
        return None, 0

    return best_intent, best_score


def extract_entities(query, intent):
    """
    Extract target entities from a query given its intent.
    Returns dict with extracted fields.
    """
    import re
    lower = query.lower().strip().rstrip("?")
    tokens = lower.split()

    entities = {}

    # Skip words that are never targets
    skip = {
        "why", "is", "the", "my", "a", "an",
        "show", "get", "list", "me", "all",
        "pod", "pods", "deployment", "deploy",
        "service", "svc", "node", "nodes",
        "please", "can", "you", "what",
        "how", "many", "which", "are",
        "failing", "crashing", "running",
        "healthy", "unhealthy", "down",
        "broken", "stuck", "pending",
        "restarting", "consuming", "consumes",
        "more", "cpu", "memory", "oom",
        "safely", "safe", "to",
    }

    # Intent-specific extraction
    if intent in (
        "diagnose", "inspect", "trace",
        "logs", "restart", "rollback",
        "rollout", "netcheck", "delete",
        "exec", "health_check", "why_failing",
    ):
        # Extract target: first non-skip word
        # that looks like a resource name
        for token in tokens:
            cleaned = token.strip("?.,!")
            if cleaned not in skip and len(cleaned) > 1:
                entities["target"] = cleaned
                break

        # Better: look after key phrases
        patterns = [
            r"(?:why is|diagnose|inspect|trace|"
            r"restart|rollback|logs for|logs of|"
            r"logs|describe|check|health of|"
            r"status of|exec|shell into|"
            r"delete|netcheck)\s+(?:the\s+)?"
            r"(?:pod\s+|deploy\s+)?"
            r"(\S+)",
        ]
        for p in patterns:
            m = re.search(p, lower)
            if m:
                candidate = m.group(1).strip("?.,!")
                if candidate not in skip:
                    entities["target"] = candidate
                    break

    elif intent == "scale":
        # Extract target and replicas
        m = re.search(
            r"scale\s+(\S+)\s+(?:to\s+)?(\d+)",
            lower
        )
        if m:
            entities["target"] = m.group(1)
            entities["replicas"] = int(m.group(2))
        else:
            m = re.search(
                r"set\s+(\S+)\s+replicas?\s+(?:to\s+)?(\d+)",
                lower
            )
            if m:
                entities["target"] = m.group(1)
                entities["replicas"] = int(m.group(2))

    elif intent == "count_pods":
        # Extract what to count
        m = re.search(
            r"(?:how many|count|number of)\s+(\S+)",
            lower
        )
        if m:
            candidate = m.group(1).strip("?.,!")
            if candidate not in skip:
                entities["target"] = candidate

    elif intent == "port_forward":
        m = re.search(
            r"(?:forward|port.?forward)\s+(\S+)\s+(\d+)",
            lower
        )
        if m:
            entities["target"] = m.group(1)
            entities["port"] = m.group(2)

    elif intent == "is_safe":
        # Extract action and target
        m = re.search(
            r"safe to (\w+)\s+(\S+)",
            lower
        )
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
