import{a as st,b as Dt}from"./chunk-BOXHEDIE.js";import{c as J}from"./chunk-G227FRKW.js";import{C as _t,D as xt,E as z,J as at,L as j,T as Ct,Z as Bt,_ as ot,f as nt,ia as F,ka as L,la as A,ma as l,na as T,t as it,w as Tt}from"./chunk-K3UHJ75B.js";import{i as U,o as O,q as Z}from"./chunk-ASI5HLN6.js";import{$a as p,Ac as yt,Cb as R,Eb as m,Fb as M,Gb as k,H as S,Hb as bt,I as B,Ia as g,Ib as pt,J as rt,Jb as v,Kb as h,L as D,Lb as ft,Mb as vt,N as o,Nb as ht,Rb as d,T as Y,U as tt,V as _,Wa as b,Xa as dt,_a as w,ab as P,ac as E,ea as K,ha as ct,hb as x,ib as I,ja as r,jb as N,jc as gt,la as lt,nc as c,ob as f,pb as V,qb as Q,rb as $,rc as y,sc as mt,tc as G,ub as q,xb as W,yb as et,zb as ut,zc as C}from"./chunk-IFA4XUDI.js";var wt=`
    .p-tabs {
        display: flex;
        flex-direction: column;
    }

    .p-tablist {
        display: flex;
        position: relative;
        overflow: hidden;
        background: dt('tabs.tablist.background');
    }

    .p-tablist-viewport {
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        scrollbar-width: none;
        overscroll-behavior: contain auto;
    }

    .p-tablist-viewport::-webkit-scrollbar {
        display: none;
    }

    .p-tablist-tab-list {
        position: relative;
        display: flex;
        border-style: solid;
        border-color: dt('tabs.tablist.border.color');
        border-width: dt('tabs.tablist.border.width');
    }

    .p-tablist-content {
        flex-grow: 1;
    }

    .p-tablist-nav-button {
        all: unset;
        position: absolute !important;
        flex-shrink: 0;
        inset-block-start: 0;
        z-index: 2;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: dt('tabs.nav.button.background');
        color: dt('tabs.nav.button.color');
        width: dt('tabs.nav.button.width');
        transition:
            color dt('tabs.transition.duration'),
            outline-color dt('tabs.transition.duration'),
            box-shadow dt('tabs.transition.duration');
        box-shadow: dt('tabs.nav.button.shadow');
        outline-color: transparent;
        cursor: pointer;
    }

    .p-tablist-nav-button:focus-visible {
        z-index: 1;
        box-shadow: dt('tabs.nav.button.focus.ring.shadow');
        outline: dt('tabs.nav.button.focus.ring.width') dt('tabs.nav.button.focus.ring.style') dt('tabs.nav.button.focus.ring.color');
        outline-offset: dt('tabs.nav.button.focus.ring.offset');
    }

    .p-tablist-nav-button:hover {
        color: dt('tabs.nav.button.hover.color');
    }

    .p-tablist-prev-button {
        inset-inline-start: 0;
    }

    .p-tablist-next-button {
        inset-inline-end: 0;
    }

    .p-tablist-prev-button:dir(rtl),
    .p-tablist-next-button:dir(rtl) {
        transform: rotate(180deg);
    }

    .p-tab {
        flex-shrink: 0;
        cursor: pointer;
        user-select: none;
        position: relative;
        border-style: solid;
        white-space: nowrap;
        gap: dt('tabs.tab.gap');
        background: dt('tabs.tab.background');
        border-width: dt('tabs.tab.border.width');
        border-color: dt('tabs.tab.border.color');
        color: dt('tabs.tab.color');
        padding: dt('tabs.tab.padding');
        font-weight: dt('tabs.tab.font.weight');
        transition:
            background dt('tabs.transition.duration'),
            border-color dt('tabs.transition.duration'),
            color dt('tabs.transition.duration'),
            outline-color dt('tabs.transition.duration'),
            box-shadow dt('tabs.transition.duration');
        margin: dt('tabs.tab.margin');
        outline-color: transparent;
    }

    .p-tab:not(.p-disabled):focus-visible {
        z-index: 1;
        box-shadow: dt('tabs.tab.focus.ring.shadow');
        outline: dt('tabs.tab.focus.ring.width') dt('tabs.tab.focus.ring.style') dt('tabs.tab.focus.ring.color');
        outline-offset: dt('tabs.tab.focus.ring.offset');
    }

    .p-tab:not(.p-tab-active):not(.p-disabled):hover {
        background: dt('tabs.tab.hover.background');
        border-color: dt('tabs.tab.hover.border.color');
        color: dt('tabs.tab.hover.color');
    }

    .p-tab-active {
        background: dt('tabs.tab.active.background');
        border-color: dt('tabs.tab.active.border.color');
        color: dt('tabs.tab.active.color');
    }

    .p-tabpanels {
        background: dt('tabs.tabpanel.background');
        color: dt('tabs.tabpanel.color');
        padding: dt('tabs.tabpanel.padding');
        outline: 0 none;
    }

    .p-tabpanel:focus-visible {
        box-shadow: dt('tabs.tabpanel.focus.ring.shadow');
        outline: dt('tabs.tabpanel.focus.ring.width') dt('tabs.tabpanel.focus.ring.style') dt('tabs.tabpanel.focus.ring.color');
        outline-offset: dt('tabs.tabpanel.focus.ring.offset');
    }

    .p-tablist-active-bar {
        z-index: 1;
        display: block;
        position: absolute;
        inset-block-end: dt('tabs.active.bar.bottom');
        height: dt('tabs.active.bar.height');
        background: dt('tabs.active.bar.background');
        transition: 250ms cubic-bezier(0.35, 0, 0.25, 1);
    }
`;var Kt=["data-p-icon","chevron-left"],Nt=(()=>{class e extends J{static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["","data-p-icon","chevron-left"]],features:[p],attrs:Kt,decls:1,vars:0,consts:[["d","M9.61296 13C9.50997 13.0005 9.40792 12.9804 9.3128 12.9409C9.21767 12.9014 9.13139 12.8433 9.05902 12.7701L3.83313 7.54416C3.68634 7.39718 3.60388 7.19795 3.60388 6.99022C3.60388 6.78249 3.68634 6.58325 3.83313 6.43628L9.05902 1.21039C9.20762 1.07192 9.40416 0.996539 9.60724 1.00012C9.81032 1.00371 10.0041 1.08597 10.1477 1.22959C10.2913 1.37322 10.3736 1.56698 10.3772 1.77005C10.3808 1.97313 10.3054 2.16968 10.1669 2.31827L5.49496 6.99022L10.1669 11.6622C10.3137 11.8091 10.3962 12.0084 10.3962 12.2161C10.3962 12.4238 10.3137 12.6231 10.1669 12.7701C10.0945 12.8433 10.0083 12.9014 9.91313 12.9409C9.81801 12.9804 9.71596 13.0005 9.61296 13Z","fill","currentColor"]],template:function(i,n){i&1&&(_(),q(0,"path",0))},encapsulation:2})}return e})();var Qt=["data-p-icon","chevron-right"],Mt=(()=>{class e extends J{static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["","data-p-icon","chevron-right"]],features:[p],attrs:Qt,decls:1,vars:0,consts:[["d","M4.38708 13C4.28408 13.0005 4.18203 12.9804 4.08691 12.9409C3.99178 12.9014 3.9055 12.8433 3.83313 12.7701C3.68634 12.6231 3.60388 12.4238 3.60388 12.2161C3.60388 12.0084 3.68634 11.8091 3.83313 11.6622L8.50507 6.99022L3.83313 2.31827C3.69467 2.16968 3.61928 1.97313 3.62287 1.77005C3.62645 1.56698 3.70872 1.37322 3.85234 1.22959C3.99596 1.08597 4.18972 1.00371 4.3928 1.00012C4.59588 0.996539 4.79242 1.07192 4.94102 1.21039L10.1669 6.43628C10.3137 6.58325 10.3962 6.78249 10.3962 6.99022C10.3962 7.19795 10.3137 7.39718 10.1669 7.54416L4.94102 12.7701C4.86865 12.8433 4.78237 12.9014 4.68724 12.9409C4.59212 12.9804 4.49007 13.0005 4.38708 13Z","fill","currentColor"]],template:function(i,n){i&1&&(_(),q(0,"path",0))},encapsulation:2})}return e})();var H=["*"],$t=["previcon"],qt=["nexticon"],zt=["content"],Wt=["prevButton"],Gt=["nextButton"],Ut=["inkbar"],Zt=["tabs"];function Jt(e,u){e&1&&W(0)}function Xt(e,u){if(e&1&&P(0,Jt,1,0,"ng-container",11),e&2){let t=m(2);f("ngTemplateOutlet",t.prevIconTemplate||t._prevIconTemplate)}}function Yt(e,u){e&1&&(_(),$(0,"svg",10))}function te(e,u){if(e&1){let t=et();V(0,"button",9,3),R("click",function(){Y(t);let n=m();return tt(n.onPrevButtonClick())}),I(2,Xt,1,1,"ng-container")(3,Yt,1,0,":svg:svg",10),Q()}if(e&2){let t=m();d(t.cx("prevButton")),f("pBind",t.ptm("prevButton")),x("aria-label",t.prevButtonAriaLabel)("tabindex",t.tabindex())("data-pc-group-section","navigator"),g(2),N(t.prevIconTemplate||t._prevIconTemplate?2:3)}}function ee(e,u){e&1&&W(0)}function ne(e,u){if(e&1&&P(0,ee,1,0,"ng-container",11),e&2){let t=m(2);f("ngTemplateOutlet",t.nextIconTemplate||t._nextIconTemplate)}}function ie(e,u){e&1&&(_(),$(0,"svg",12))}function ae(e,u){if(e&1){let t=et();V(0,"button",9,4),R("click",function(){Y(t);let n=m();return tt(n.onNextButtonClick())}),I(2,ne,1,1,"ng-container")(3,ie,1,0,":svg:svg",12),Q()}if(e&2){let t=m();d(t.cx("nextButton")),f("pBind",t.ptm("nextButton")),x("aria-label",t.nextButtonAriaLabel)("tabindex",t.tabindex())("data-pc-group-section","navigator"),g(2),N(t.nextIconTemplate||t._nextIconTemplate?2:3)}}function oe(e,u){e&1&&k(0)}function se(e,u){e&1&&W(0)}function re(e,u){if(e&1&&P(0,se,1,0,"ng-container",1),e&2){let t=m(),i=ht(1);f("ngTemplateOutlet",t.content()?t.content():i)}}var ce={root:({instance:e})=>["p-tabs p-component",{"p-tabs-scrollable":e.scrollable()}]},kt=(()=>{class e extends F{name="tabs";style=wt;classes=ce;static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275prov=B({token:e,factory:e.\u0275fac})}return e})();var Et=new D("TABS_INSTANCE"),X=(()=>{class e extends A{componentName="Tabs";$pcTabs=o(Et,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(l,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}value=G(void 0);scrollable=y(!1,{transform:C});lazy=y(!1,{transform:C});selectOnFocus=y(!1,{transform:C});showNavigators=y(!0,{transform:C});tabindex=y(0,{transform:yt});id=K(Ct("pn_id_"));_componentStyle=o(kt);updateValue(t){this.value.update(()=>t)}static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["p-tabs"]],hostVars:3,hostBindings:function(i,n){i&2&&(x("id",n.id()),d(n.cx("root")))},inputs:{value:[1,"value"],scrollable:[1,"scrollable"],lazy:[1,"lazy"],selectOnFocus:[1,"selectOnFocus"],showNavigators:[1,"showNavigators"],tabindex:[1,"tabindex"]},outputs:{value:"valueChange"},features:[E([kt,{provide:Et,useExisting:e},{provide:L,useExisting:e}]),w([l]),p],ngContentSelectors:H,decls:1,vars:0,template:function(i,n){i&1&&(M(),k(0))},dependencies:[O,T],encapsulation:2,changeDetection:0})}return e})(),le={root:({instance:e})=>["p-tab",{"p-tab-active":e.active(),"p-disabled":e.disabled()}]},Ft=(()=>{class e extends F{name="tab";classes=le;static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275prov=B({token:e,factory:e.\u0275fac})}return e})();var de={root:"p-tablist",content:"p-tablist-content p-tablist-viewport",tabList:"p-tablist-tab-list",activeBar:"p-tablist-active-bar",prevButton:"p-tablist-prev-button p-tablist-nav-button",nextButton:"p-tablist-next-button p-tablist-nav-button"},Lt=(()=>{class e extends F{name="tablist";classes=de;static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275prov=B({token:e,factory:e.\u0275fac})}return e})();var At=new D("TABLIST_INSTANCE"),jt=(()=>{class e extends A{componentName="TabList";$pcTabList=o(At,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(l,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}prevIconTemplate;nextIconTemplate;templates;content;prevButton;nextButton;inkbar;tabs;pcTabs=o(S(()=>X));isPrevButtonEnabled=K(!1);isNextButtonEnabled=K(!1);resizeObserver;showNavigators=c(()=>this.pcTabs.showNavigators());tabindex=c(()=>this.pcTabs.tabindex());scrollable=c(()=>this.pcTabs.scrollable());_componentStyle=o(Lt);constructor(){super(),ct(()=>{this.pcTabs.value(),Z(this.platformId)&&setTimeout(()=>{this.updateInkBar()})})}get prevButtonAriaLabel(){return this.config?.translation?.aria?.previous}get nextButtonAriaLabel(){return this.config?.translation?.aria?.next}onAfterViewInit(){this.showNavigators()&&Z(this.platformId)&&(this.updateButtonState(),this.bindResizeObserver())}_prevIconTemplate;_nextIconTemplate;onAfterContentInit(){this.templates?.forEach(t=>{switch(t.getType()){case"previcon":this._prevIconTemplate=t.template;break;case"nexticon":this._nextIconTemplate=t.template;break}})}onDestroy(){this.unbindResizeObserver()}onScroll(t){this.showNavigators()&&this.updateButtonState(),t.preventDefault()}onPrevButtonClick(){let t=this.content.nativeElement,i=j(t),n=Math.abs(t.scrollLeft)-i,a=n<=0?0:n;t.scrollLeft=it(t)?-1*a:a}onNextButtonClick(){let t=this.content.nativeElement,i=j(t)-this.getVisibleButtonWidths(),n=t.scrollLeft+i,a=t.scrollWidth-i,s=n>=a?a:n;t.scrollLeft=it(t)?-1*s:s}updateButtonState(){let t=this.content?.nativeElement,i=this.el?.nativeElement,{scrollWidth:n,offsetWidth:a}=t,s=Math.abs(t.scrollLeft),Ht=j(t);this.isPrevButtonEnabled.set(s!==0),this.isNextButtonEnabled.set(i.offsetWidth>=a&&Math.abs(s-n+Ht)>1)}updateInkBar(){let t=this.content?.nativeElement,i=this.inkbar?.nativeElement,n=this.tabs?.nativeElement,a=_t(t,'[data-pc-name="tab"][data-p-active="true"]');i&&(i.style.width=Tt(a)+"px",i.style.left=at(a).left-at(n).left+"px")}getVisibleButtonWidths(){let t=this.prevButton?.nativeElement,i=this.nextButton?.nativeElement;return[t,i].reduce((n,a)=>a?n+j(a):n,0)}bindResizeObserver(){this.resizeObserver=new ResizeObserver(()=>this.updateButtonState()),this.resizeObserver.observe(this.el.nativeElement)}unbindResizeObserver(){this.resizeObserver&&(this.resizeObserver.unobserve(this.el.nativeElement),this.resizeObserver=null)}static \u0275fac=function(i){return new(i||e)};static \u0275cmp=b({type:e,selectors:[["p-tablist"]],contentQueries:function(i,n,a){if(i&1&&bt(a,$t,4)(a,qt,4)(a,Bt,4),i&2){let s;v(s=h())&&(n.prevIconTemplate=s.first),v(s=h())&&(n.nextIconTemplate=s.first),v(s=h())&&(n.templates=s)}},viewQuery:function(i,n){if(i&1&&pt(zt,5)(Wt,5)(Gt,5)(Ut,5)(Zt,5),i&2){let a;v(a=h())&&(n.content=a.first),v(a=h())&&(n.prevButton=a.first),v(a=h())&&(n.nextButton=a.first),v(a=h())&&(n.inkbar=a.first),v(a=h())&&(n.tabs=a.first)}},hostVars:2,hostBindings:function(i,n){i&2&&d(n.cx("root"))},features:[E([Lt,{provide:At,useExisting:e},{provide:L,useExisting:e}]),w([l]),p],ngContentSelectors:H,decls:9,vars:11,consts:[["content",""],["tabs",""],["inkbar",""],["prevButton",""],["nextButton",""],["type","button","pRipple","",3,"pBind","class"],[3,"scroll","pBind"],["role","tablist",3,"pBind"],["role","presentation",3,"pBind"],["type","button","pRipple","",3,"click","pBind"],["data-p-icon","chevron-left"],[4,"ngTemplateOutlet"],["data-p-icon","chevron-right"]],template:function(i,n){i&1&&(M(),I(0,te,4,7,"button",5),V(1,"div",6,0),R("scroll",function(s){return n.onScroll(s)}),V(3,"div",7,1),k(5),$(6,"span",8,2),Q()(),I(8,ae,4,7,"button",5)),i&2&&(N(n.showNavigators()&&n.isPrevButtonEnabled()?0:-1),g(),d(n.cx("content")),f("pBind",n.ptm("content")),g(2),d(n.cx("tabList")),f("pBind",n.ptm("tabList")),g(3),d(n.cx("activeBar")),f("pBind",n.ptm("activeBar")),g(2),N(n.showNavigators()&&n.isNextButtonEnabled()?8:-1))},dependencies:[O,U,Nt,Mt,Dt,st,ot,T,l],encapsulation:2,changeDetection:0})}return e})(),St=new D("TAB_INSTANCE"),ue=(()=>{class e extends A{componentName="Tab";$pcTab=o(St,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(l,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}value=G();disabled=y(!1,{transform:C});pcTabs=o(S(()=>X));pcTabList=o(S(()=>jt));el=o(lt);_componentStyle=o(Ft);ripple=c(()=>this.config.ripple());id=c(()=>`${this.pcTabs.id()}_tab_${this.value()}`);ariaControls=c(()=>`${this.pcTabs.id()}_tabpanel_${this.value()}`);active=c(()=>nt(this.pcTabs.value(),this.value()));tabindex=c(()=>this.disabled()?-1:this.active()?this.pcTabs.tabindex():-1);mutationObserver;onFocus(t){this.disabled()||this.pcTabs.selectOnFocus()&&this.changeActiveValue()}onClick(t){this.disabled()||this.changeActiveValue()}onKeyDown(t){switch(t.code){case"ArrowRight":this.onArrowRightKey(t);break;case"ArrowLeft":this.onArrowLeftKey(t);break;case"Home":this.onHomeKey(t);break;case"End":this.onEndKey(t);break;case"PageDown":this.onPageDownKey(t);break;case"PageUp":this.onPageUpKey(t);break;case"Enter":case"NumpadEnter":case"Space":this.onEnterKey(t);break;default:break}t.stopPropagation()}onAfterViewInit(){this.bindMutationObserver()}onArrowRightKey(t){let i=this.findNextTab(t.currentTarget);i?this.changeFocusedTab(t,i):this.onHomeKey(t),t.preventDefault()}onArrowLeftKey(t){let i=this.findPrevTab(t.currentTarget);i?this.changeFocusedTab(t,i):this.onEndKey(t),t.preventDefault()}onHomeKey(t){let i=this.findFirstTab();this.changeFocusedTab(t,i),t.preventDefault()}onEndKey(t){let i=this.findLastTab();this.changeFocusedTab(t,i),t.preventDefault()}onPageDownKey(t){this.scrollInView(this.findLastTab()),t.preventDefault()}onPageUpKey(t){this.scrollInView(this.findFirstTab()),t.preventDefault()}onEnterKey(t){this.disabled()||this.changeActiveValue(),t.preventDefault()}findNextTab(t,i=!1){let n=i?t:t.nextElementSibling;return n?z(n,"data-p-disabled")||z(n,"data-pc-section")==="activebar"?this.findNextTab(n):n:null}findPrevTab(t,i=!1){let n=i?t:t.previousElementSibling;return n?z(n,"data-p-disabled")||z(n,"data-pc-section")==="activebar"?this.findPrevTab(n):n:null}findFirstTab(){return this.findNextTab(this.pcTabList?.tabs?.nativeElement?.firstElementChild,!0)}findLastTab(){return this.findPrevTab(this.pcTabList?.tabs?.nativeElement?.lastElementChild,!0)}changeActiveValue(){this.pcTabs.updateValue(this.value())}changeFocusedTab(t,i){xt(i),this.scrollInView(i)}scrollInView(t){t?.scrollIntoView?.({block:"nearest"})}bindMutationObserver(){Z(this.platformId)&&(this.mutationObserver=new MutationObserver(t=>{t.forEach(()=>{this.active()&&this.pcTabList?.updateInkBar()})}),this.mutationObserver.observe(this.el.nativeElement,{childList:!0,characterData:!0,subtree:!0}))}unbindMutationObserver(){this.mutationObserver?.disconnect()}onDestroy(){this.mutationObserver&&this.unbindMutationObserver()}static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["p-tab"]],hostVars:10,hostBindings:function(i,n){i&1&&R("focus",function(s){return n.onFocus(s)})("click",function(s){return n.onClick(s)})("keydown",function(s){return n.onKeyDown(s)}),i&2&&(x("id",n.id())("aria-controls",n.ariaControls())("role","tab")("aria-selected",n.active())("aria-disabled",n.disabled())("data-p-disabled",n.disabled())("data-p-active",n.active())("tabindex",n.tabindex()),d(n.cx("root")))},inputs:{value:[1,"value"],disabled:[1,"disabled"]},outputs:{value:"valueChange"},features:[E([Ft,{provide:St,useExisting:e},{provide:L,useExisting:e}]),w([st,l]),p],ngContentSelectors:H,decls:1,vars:0,template:function(i,n){i&1&&(M(),k(0))},dependencies:[O,ot,T],encapsulation:2,changeDetection:0})}return e})(),be={root:({instance:e})=>["p-tabpanel",{"p-tabpanel-active":e.active()}]},Pt=(()=>{class e extends F{name="tabpanel";classes=be;static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275prov=B({token:e,factory:e.\u0275fac})}return e})();var Vt=new D("TABPANEL_INSTANCE"),pe=(()=>{class e extends A{componentName="TabPanel";$pcTabPanel=o(Vt,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(l,{self:!0});pcTabs=o(S(()=>X));onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}lazy=y(!1,{transform:C});value=G(void 0);content=mt("content");id=c(()=>`${this.pcTabs.id()}_tabpanel_${this.value()}`);ariaLabelledby=c(()=>`${this.pcTabs.id()}_tab_${this.value()}`);active=c(()=>nt(this.pcTabs.value(),this.value()));isLazyEnabled=c(()=>this.pcTabs.lazy()||this.lazy());hasBeenRendered=!1;shouldRender=c(()=>!this.isLazyEnabled()||this.hasBeenRendered?!0:this.active()?(this.hasBeenRendered=!0,!0):!1);_componentStyle=o(Pt);static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["p-tabpanel"]],contentQueries:function(i,n,a){i&1&&ft(a,n.content,zt,5),i&2&&vt()},hostVars:7,hostBindings:function(i,n){i&2&&(ut("hidden",!n.active()),x("id",n.id())("role","tabpanel")("aria-labelledby",n.ariaLabelledby())("data-p-active",n.active()),d(n.cx("root")))},inputs:{lazy:[1,"lazy"],value:[1,"value"]},outputs:{value:"valueChange"},features:[E([Pt,{provide:Vt,useExisting:e},{provide:L,useExisting:e}]),w([l]),p],ngContentSelectors:H,decls:3,vars:1,consts:[["defaultContent",""],[4,"ngTemplateOutlet"]],template:function(i,n){i&1&&(M(),P(0,oe,1,0,"ng-template",null,0,gt),I(2,re,1,1,"ng-container")),i&2&&(g(2),N(n.shouldRender()?2:-1))},dependencies:[U,T],encapsulation:2,changeDetection:0})}return e})(),fe={root:"p-tabpanels"},Rt=(()=>{class e extends F{name="tabpanels";classes=fe;static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275prov=B({token:e,factory:e.\u0275fac})}return e})();var Ot=new D("TABPANELS_INSTANCE"),ve=(()=>{class e extends A{componentName="TabPanels";$pcTabPanels=o(Ot,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(l,{self:!0});_componentStyle=o(Rt);onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}static \u0275fac=(()=>{let t;return function(n){return(t||(t=r(e)))(n||e)}})();static \u0275cmp=b({type:e,selectors:[["p-tabpanels"]],hostVars:3,hostBindings:function(i,n){i&2&&(x("role","presentation"),d(n.cx("root")))},features:[E([Rt,{provide:Ot,useExisting:e},{provide:L,useExisting:e}]),w([l]),p],ngContentSelectors:H,decls:1,vars:0,template:function(i,n){i&1&&(M(),k(0))},dependencies:[O,T],encapsulation:2,changeDetection:0})}return e})(),Qe=(()=>{class e{static \u0275fac=function(i){return new(i||e)};static \u0275mod=dt({type:e});static \u0275inj=rt({imports:[X,ve,pe,jt,ue,T,T]})}return e})();export{X as a,jt as b,ue as c,pe as d,ve as e,Qe as f};
