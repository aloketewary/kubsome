import{a as He}from"./chunk-2RZSDYTC.js";import{a as Je,b as et}from"./chunk-I6YRAZLQ.js";import{a as $e}from"./chunk-YRCN3WHX.js";import{b as Ge,c as Xe}from"./chunk-QQE42YEY.js";import{a as qe,c as Ke,d as We}from"./chunk-SFQGNW57.js";import{a as Ye,c as Ue}from"./chunk-WUSVZFIE.js";import"./chunk-BOXHEDIE.js";import{c as ue}from"./chunk-G227FRKW.js";import{c as Le,e as je,f as Ze,m as Qe}from"./chunk-DRXOS5RM.js";import{h as Fe,k as Ne}from"./chunk-24JL4AIN.js";import{b as me}from"./chunk-U5EAHB4L.js";import"./chunk-SHVRSAY4.js";import{S as ye,T as H,V as de,X as ze,Y as Re,Z as G,_ as T,b as Pe,f as Ve,ia as X,ka as K,la as F,ma as y,na as pe}from"./chunk-K3UHJ75B.js";import{e as De,f as Oe,g as le,i as ce,o as O}from"./chunk-ASI5HLN6.js";import"./chunk-MS2DIPBN.js";import{$ as he,$a as w,Ac as te,Cb as $,Eb as r,Fb as we,Gb as ie,Hb as ae,I as P,Ia as a,J as V,Jb as C,Kb as v,L as z,N as _,Qb as q,Ra as ve,Rb as m,Sb as h,T as S,Tb as D,U as E,Ub as ee,V as I,Wa as b,Xa as R,Xb as ke,Yb as Me,Zb as Se,_a as L,aa as be,ab as g,ac as M,cc as Ee,dc as Ae,ea as W,ha as Ce,hb as u,ib as A,ja as x,jb as B,lb as Te,mb as xe,nb as Ie,nc as Be,ob as s,pb as c,qb as d,qc as _e,rb as f,rc as se,sb as j,tb as Z,ub as Q,vb as Y,wb as U,xb as k,yb as J,zb as oe,zc as re}from"./chunk-IFA4XUDI.js";import{a as N,b as ge}from"./chunk-VG67F64M.js";var tt=`
    .p-card {
        background: dt('card.background');
        color: dt('card.color');
        box-shadow: dt('card.shadow');
        border-radius: dt('card.border.radius');
        display: flex;
        flex-direction: column;
    }

    .p-card-caption {
        display: flex;
        flex-direction: column;
        gap: dt('card.caption.gap');
    }

    .p-card-body {
        padding: dt('card.body.padding');
        display: flex;
        flex-direction: column;
        gap: dt('card.body.gap');
    }

    .p-card-title {
        font-size: dt('card.title.font.size');
        font-weight: dt('card.title.font.weight');
    }

    .p-card-subtitle {
        color: dt('card.subtitle.color');
    }
`;var _t=["header"],yt=["title"],bt=["subtitle"],Ct=["content"],vt=["footer"],Tt=["*",[["p-header"]],[["p-footer"]]],xt=["*","p-header","p-footer"];function It(t,i){t&1&&k(0)}function wt(t,i){if(t&1&&(c(0,"div",1),ie(1,1),g(2,It,1,0,"ng-container",2),d()),t&2){let e=r();m(e.cx("header")),s("pBind",e.ptm("header")),a(2),s("ngTemplateOutlet",e.headerTemplate||e._headerTemplate)}}function kt(t,i){if(t&1&&(Y(0),h(1),U()),t&2){let e=r(2);a(),D(e.header)}}function Mt(t,i){t&1&&k(0)}function St(t,i){if(t&1&&(c(0,"div",1),g(1,kt,2,1,"ng-container",3)(2,Mt,1,0,"ng-container",2),d()),t&2){let e=r();m(e.cx("title")),s("pBind",e.ptm("title")),a(),s("ngIf",e.header&&!e._titleTemplate&&!e.titleTemplate),a(),s("ngTemplateOutlet",e.titleTemplate||e._titleTemplate)}}function Et(t,i){if(t&1&&(Y(0),h(1),U()),t&2){let e=r(2);a(),D(e.subheader)}}function At(t,i){t&1&&k(0)}function Bt(t,i){if(t&1&&(c(0,"div",1),g(1,Et,2,1,"ng-container",3)(2,At,1,0,"ng-container",2),d()),t&2){let e=r();m(e.cx("subtitle")),s("pBind",e.ptm("subtitle")),a(),s("ngIf",e.subheader&&!e._subtitleTemplate&&!e.subtitleTemplate),a(),s("ngTemplateOutlet",e.subtitleTemplate||e._subtitleTemplate)}}function Dt(t,i){t&1&&k(0)}function Ot(t,i){t&1&&k(0)}function Ft(t,i){if(t&1&&(c(0,"div",1),ie(1,2),g(2,Ot,1,0,"ng-container",2),d()),t&2){let e=r();m(e.cx("footer")),s("pBind",e.ptm("footer")),a(2),s("ngTemplateOutlet",e.footerTemplate||e._footerTemplate)}}var Nt=`
    ${tt}

    .p-card {
        display: block;
    }
`,Pt={root:"p-card p-component",header:"p-card-header",body:"p-card-body",caption:"p-card-caption",title:"p-card-title",subtitle:"p-card-subtitle",content:"p-card-content",footer:"p-card-footer"},nt=(()=>{class t extends X{name="card";style=Nt;classes=Pt;static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275prov=P({token:t,factory:t.\u0275fac})}return t})();var ot=new z("CARD_INSTANCE"),Vt=(()=>{class t extends F{componentName="Card";$pcCard=_(ot,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=_(y,{self:!0});_componentStyle=_(nt);onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}header;subheader;set style(e){Ve(this._style(),e)||(this._style.set(e),this.el?.nativeElement&&e&&Object.keys(e).forEach(o=>{this.el.nativeElement.style[o]=e[o]}))}get style(){return this._style()}styleClass;headerFacet;footerFacet;headerTemplate;titleTemplate;subtitleTemplate;contentTemplate;footerTemplate;_headerTemplate;_titleTemplate;_subtitleTemplate;_contentTemplate;_footerTemplate;_style=W(null);getBlockableElement(){return this.el.nativeElement}templates;onAfterContentInit(){this.templates.forEach(e=>{switch(e.getType()){case"header":this._headerTemplate=e.template;break;case"title":this._titleTemplate=e.template;break;case"subtitle":this._subtitleTemplate=e.template;break;case"content":this._contentTemplate=e.template;break;case"footer":this._footerTemplate=e.template;break;default:this._contentTemplate=e.template;break}})}static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275cmp=b({type:t,selectors:[["p-card"]],contentQueries:function(o,n,l){if(o&1&&ae(l,ze,5)(l,Re,5)(l,_t,4)(l,yt,4)(l,bt,4)(l,Ct,4)(l,vt,4)(l,G,4),o&2){let p;C(p=v())&&(n.headerFacet=p.first),C(p=v())&&(n.footerFacet=p.first),C(p=v())&&(n.headerTemplate=p.first),C(p=v())&&(n.titleTemplate=p.first),C(p=v())&&(n.subtitleTemplate=p.first),C(p=v())&&(n.contentTemplate=p.first),C(p=v())&&(n.footerTemplate=p.first),C(p=v())&&(n.templates=p)}},hostVars:4,hostBindings:function(o,n){o&2&&(q(n._style()),m(n.cn(n.cx("root"),n.styleClass)))},inputs:{header:"header",subheader:"subheader",style:"style",styleClass:"styleClass"},features:[M([nt,{provide:ot,useExisting:t},{provide:K,useExisting:t}]),L([y]),w],ngContentSelectors:xt,decls:8,vars:11,consts:[[3,"pBind","class",4,"ngIf"],[3,"pBind"],[4,"ngTemplateOutlet"],[4,"ngIf"]],template:function(o,n){o&1&&(we(Tt),g(0,wt,3,4,"div",0),c(1,"div",1),g(2,St,3,5,"div",0)(3,Bt,3,5,"div",0),c(4,"div",1),ie(5),g(6,Dt,1,0,"ng-container",2),d(),g(7,Ft,3,4,"div",0),d()),o&2&&(s("ngIf",n.headerFacet||n.headerTemplate||n._headerTemplate),a(),m(n.cx("body")),s("pBind",n.ptm("body")),a(),s("ngIf",n.header||n.titleTemplate||n._titleTemplate),a(),s("ngIf",n.subheader||n.subtitleTemplate||n._subtitleTemplate),a(),m(n.cx("content")),s("pBind",n.ptm("content")),a(2),s("ngTemplateOutlet",n.contentTemplate||n._contentTemplate),a(),s("ngIf",n.footerFacet||n.footerTemplate||n._footerTemplate))},dependencies:[O,le,ce,T,pe,y],encapsulation:2,changeDetection:0})}return t})(),at=(()=>{class t{static \u0275fac=function(o){return new(o||t)};static \u0275mod=R({type:t});static \u0275inj=V({imports:[Vt,T,pe,T,pe]})}return t})();var zt=["data-p-icon","exclamation-triangle"],st=(()=>{class t extends ue{pathId;onInit(){this.pathId="url(#"+H()+")"}static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275cmp=b({type:t,selectors:[["","data-p-icon","exclamation-triangle"]],features:[w],attrs:zt,decls:7,vars:2,consts:[["d","M13.4018 13.1893H0.598161C0.49329 13.189 0.390283 13.1615 0.299143 13.1097C0.208003 13.0578 0.131826 12.9832 0.0780112 12.8932C0.0268539 12.8015 0 12.6982 0 12.5931C0 12.4881 0.0268539 12.3848 0.0780112 12.293L6.47985 1.08982C6.53679 1.00399 6.61408 0.933574 6.70484 0.884867C6.7956 0.836159 6.897 0.810669 7 0.810669C7.103 0.810669 7.2044 0.836159 7.29516 0.884867C7.38592 0.933574 7.46321 1.00399 7.52015 1.08982L13.922 12.293C13.9731 12.3848 14 12.4881 14 12.5931C14 12.6982 13.9731 12.8015 13.922 12.8932C13.8682 12.9832 13.792 13.0578 13.7009 13.1097C13.6097 13.1615 13.5067 13.189 13.4018 13.1893ZM1.63046 11.989H12.3695L7 2.59425L1.63046 11.989Z","fill","currentColor"],["d","M6.99996 8.78801C6.84143 8.78594 6.68997 8.72204 6.57787 8.60993C6.46576 8.49782 6.40186 8.34637 6.39979 8.18784V5.38703C6.39979 5.22786 6.46302 5.0752 6.57557 4.96265C6.68813 4.85009 6.84078 4.78686 6.99996 4.78686C7.15914 4.78686 7.31179 4.85009 7.42435 4.96265C7.5369 5.0752 7.60013 5.22786 7.60013 5.38703V8.18784C7.59806 8.34637 7.53416 8.49782 7.42205 8.60993C7.30995 8.72204 7.15849 8.78594 6.99996 8.78801Z","fill","currentColor"],["d","M6.99996 11.1887C6.84143 11.1866 6.68997 11.1227 6.57787 11.0106C6.46576 10.8985 6.40186 10.7471 6.39979 10.5885V10.1884C6.39979 10.0292 6.46302 9.87658 6.57557 9.76403C6.68813 9.65147 6.84078 9.58824 6.99996 9.58824C7.15914 9.58824 7.31179 9.65147 7.42435 9.76403C7.5369 9.87658 7.60013 10.0292 7.60013 10.1884V10.5885C7.59806 10.7471 7.53416 10.8985 7.42205 11.0106C7.30995 11.1227 7.15849 11.1866 6.99996 11.1887Z","fill","currentColor"],[3,"id"],["width","14","height","14","fill","white"]],template:function(o,n){o&1&&(I(),j(0,"g"),Q(1,"path",0)(2,"path",1)(3,"path",2),Z(),j(4,"defs")(5,"clipPath",3),Q(6,"rect",4),Z()()),o&2&&(u("clip-path",n.pathId),a(5),oe("id",n.pathId))},encapsulation:2})}return t})();var Rt=["data-p-icon","info-circle"],rt=(()=>{class t extends ue{pathId;onInit(){this.pathId="url(#"+H()+")"}static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275cmp=b({type:t,selectors:[["","data-p-icon","info-circle"]],features:[w],attrs:Rt,decls:5,vars:2,consts:[["fill-rule","evenodd","clip-rule","evenodd","d","M3.11101 12.8203C4.26215 13.5895 5.61553 14 7 14C8.85652 14 10.637 13.2625 11.9497 11.9497C13.2625 10.637 14 8.85652 14 7C14 5.61553 13.5895 4.26215 12.8203 3.11101C12.0511 1.95987 10.9579 1.06266 9.67879 0.532846C8.3997 0.00303296 6.99224 -0.13559 5.63437 0.134506C4.2765 0.404603 3.02922 1.07129 2.05026 2.05026C1.07129 3.02922 0.404603 4.2765 0.134506 5.63437C-0.13559 6.99224 0.00303296 8.3997 0.532846 9.67879C1.06266 10.9579 1.95987 12.0511 3.11101 12.8203ZM3.75918 2.14976C4.71846 1.50879 5.84628 1.16667 7 1.16667C8.5471 1.16667 10.0308 1.78125 11.1248 2.87521C12.2188 3.96918 12.8333 5.45291 12.8333 7C12.8333 8.15373 12.4912 9.28154 11.8502 10.2408C11.2093 11.2001 10.2982 11.9478 9.23232 12.3893C8.16642 12.8308 6.99353 12.9463 5.86198 12.7212C4.73042 12.4962 3.69102 11.9406 2.87521 11.1248C2.05941 10.309 1.50384 9.26958 1.27876 8.13803C1.05367 7.00647 1.16919 5.83358 1.61071 4.76768C2.05222 3.70178 2.79989 2.79074 3.75918 2.14976ZM7.00002 4.8611C6.84594 4.85908 6.69873 4.79698 6.58977 4.68801C6.48081 4.57905 6.4187 4.43185 6.41669 4.27776V3.88888C6.41669 3.73417 6.47815 3.58579 6.58754 3.4764C6.69694 3.367 6.84531 3.30554 7.00002 3.30554C7.15473 3.30554 7.3031 3.367 7.4125 3.4764C7.52189 3.58579 7.58335 3.73417 7.58335 3.88888V4.27776C7.58134 4.43185 7.51923 4.57905 7.41027 4.68801C7.30131 4.79698 7.1541 4.85908 7.00002 4.8611ZM7.00002 10.6945C6.84594 10.6925 6.69873 10.6304 6.58977 10.5214C6.48081 10.4124 6.4187 10.2652 6.41669 10.1111V6.22225C6.41669 6.06754 6.47815 5.91917 6.58754 5.80977C6.69694 5.70037 6.84531 5.63892 7.00002 5.63892C7.15473 5.63892 7.3031 5.70037 7.4125 5.80977C7.52189 5.91917 7.58335 6.06754 7.58335 6.22225V10.1111C7.58134 10.2652 7.51923 10.4124 7.41027 10.5214C7.30131 10.6304 7.1541 10.6925 7.00002 10.6945Z","fill","currentColor"],[3,"id"],["width","14","height","14","fill","white"]],template:function(o,n){o&1&&(I(),j(0,"g"),Q(1,"path",0),Z(),j(2,"defs")(3,"clipPath",1),Q(4,"rect",2),Z()()),o&2&&(u("clip-path",n.pathId),a(3),oe("id",n.pathId))},encapsulation:2})}return t})();var lt=`
    .p-skeleton {
        display: block;
        overflow: hidden;
        background: dt('skeleton.background');
        border-radius: dt('skeleton.border.radius');
    }

    .p-skeleton::after {
        content: '';
        animation: p-skeleton-animation 1.2s infinite;
        height: 100%;
        left: 0;
        position: absolute;
        right: 0;
        top: 0;
        transform: translateX(-100%);
        z-index: 1;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0), dt('skeleton.animation.background'), rgba(255, 255, 255, 0));
    }

    [dir='rtl'] .p-skeleton::after {
        animation-name: p-skeleton-animation-rtl;
    }

    .p-skeleton-circle {
        border-radius: 50%;
    }

    .p-skeleton-animation-none::after {
        animation: none;
    }

    @keyframes p-skeleton-animation {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(100%);
        }
    }

    @keyframes p-skeleton-animation-rtl {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(-100%);
        }
    }
`;var Lt={root:{position:"relative"}},jt={root:({instance:t})=>["p-skeleton p-component",{"p-skeleton-circle":t.shape==="circle","p-skeleton-animation-none":t.animation==="none"}]},ct=(()=>{class t extends X{name="skeleton";style=lt;classes=jt;inlineStyles=Lt;static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275prov=P({token:t,factory:t.\u0275fac})}return t})();var dt=new z("SKELETON_INSTANCE"),Zt=(()=>{class t extends F{componentName="Skeleton";$pcSkeleton=_(dt,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=_(y,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}styleClass;shape="rectangle";animation="wave";borderRadius;size;width="100%";height="1rem";_componentStyle=_(ct);get containerStyle(){let e=this._componentStyle?.inlineStyles.root,o;return this.$unstyled()||(this.size?o=ge(N({},e),{width:this.size,height:this.size,borderRadius:this.borderRadius}):o=ge(N({},e),{width:this.width,height:this.height,borderRadius:this.borderRadius})),o}get dataP(){return this.cn({[this.shape]:this.shape})}static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275cmp=b({type:t,selectors:[["p-skeleton"]],hostVars:6,hostBindings:function(o,n){o&2&&(u("aria-hidden",!0)("data-p",n.dataP),q(n.containerStyle),m(n.cn(n.cx("root"),n.styleClass)))},inputs:{styleClass:"styleClass",shape:"shape",animation:"animation",borderRadius:"borderRadius",size:"size",width:"width",height:"height"},features:[M([ct,{provide:dt,useExisting:t},{provide:K,useExisting:t}]),L([y]),w],decls:0,vars:0,template:function(o,n){},dependencies:[O,T],encapsulation:2,changeDetection:0})}return t})(),pt=(()=>{class t{static \u0275fac=function(o){return new(o||t)};static \u0275mod=R({type:t});static \u0275inj=V({imports:[Zt,T,T]})}return t})();var mt=`
    .p-toast {
        width: dt('toast.width');
        white-space: pre-line;
        word-break: break-word;
    }

    .p-toast-message {
        margin: 0 0 1rem 0;
        display: grid;
        grid-template-rows: 1fr;
    }

    .p-toast-message-icon {
        flex-shrink: 0;
        font-size: dt('toast.icon.size');
        width: dt('toast.icon.size');
        height: dt('toast.icon.size');
    }

    .p-toast-message-content {
        display: flex;
        align-items: flex-start;
        padding: dt('toast.content.padding');
        gap: dt('toast.content.gap');
        min-height: 0;
        overflow: hidden;
        transition: padding 250ms ease-in;
    }

    .p-toast-message-text {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: dt('toast.text.gap');
    }

    .p-toast-summary {
        font-weight: dt('toast.summary.font.weight');
        font-size: dt('toast.summary.font.size');
    }

    .p-toast-detail {
        font-weight: dt('toast.detail.font.weight');
        font-size: dt('toast.detail.font.size');
    }

    .p-toast-close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        background: transparent;
        transition:
            background dt('toast.transition.duration'),
            color dt('toast.transition.duration'),
            outline-color dt('toast.transition.duration'),
            box-shadow dt('toast.transition.duration');
        outline-color: transparent;
        color: inherit;
        width: dt('toast.close.button.width');
        height: dt('toast.close.button.height');
        border-radius: dt('toast.close.button.border.radius');
        margin: -25% 0 0 0;
        right: -25%;
        padding: 0;
        border: none;
        user-select: none;
    }

    .p-toast-close-button:dir(rtl) {
        margin: -25% 0 0 auto;
        left: -25%;
        right: auto;
    }

    .p-toast-message-info,
    .p-toast-message-success,
    .p-toast-message-warn,
    .p-toast-message-error,
    .p-toast-message-secondary,
    .p-toast-message-contrast {
        border-width: dt('toast.border.width');
        border-style: solid;
        backdrop-filter: blur(dt('toast.blur'));
        border-radius: dt('toast.border.radius');
    }

    .p-toast-close-icon {
        font-size: dt('toast.close.icon.size');
        width: dt('toast.close.icon.size');
        height: dt('toast.close.icon.size');
    }

    .p-toast-close-button:focus-visible {
        outline-width: dt('focus.ring.width');
        outline-style: dt('focus.ring.style');
        outline-offset: dt('focus.ring.offset');
    }

    .p-toast-message-info {
        background: dt('toast.info.background');
        border-color: dt('toast.info.border.color');
        color: dt('toast.info.color');
        box-shadow: dt('toast.info.shadow');
    }

    .p-toast-message-info .p-toast-detail {
        color: dt('toast.info.detail.color');
    }

    .p-toast-message-info .p-toast-close-button:focus-visible {
        outline-color: dt('toast.info.close.button.focus.ring.color');
        box-shadow: dt('toast.info.close.button.focus.ring.shadow');
    }

    .p-toast-message-info .p-toast-close-button:hover {
        background: dt('toast.info.close.button.hover.background');
    }

    .p-toast-message-success {
        background: dt('toast.success.background');
        border-color: dt('toast.success.border.color');
        color: dt('toast.success.color');
        box-shadow: dt('toast.success.shadow');
    }

    .p-toast-message-success .p-toast-detail {
        color: dt('toast.success.detail.color');
    }

    .p-toast-message-success .p-toast-close-button:focus-visible {
        outline-color: dt('toast.success.close.button.focus.ring.color');
        box-shadow: dt('toast.success.close.button.focus.ring.shadow');
    }

    .p-toast-message-success .p-toast-close-button:hover {
        background: dt('toast.success.close.button.hover.background');
    }

    .p-toast-message-warn {
        background: dt('toast.warn.background');
        border-color: dt('toast.warn.border.color');
        color: dt('toast.warn.color');
        box-shadow: dt('toast.warn.shadow');
    }

    .p-toast-message-warn .p-toast-detail {
        color: dt('toast.warn.detail.color');
    }

    .p-toast-message-warn .p-toast-close-button:focus-visible {
        outline-color: dt('toast.warn.close.button.focus.ring.color');
        box-shadow: dt('toast.warn.close.button.focus.ring.shadow');
    }

    .p-toast-message-warn .p-toast-close-button:hover {
        background: dt('toast.warn.close.button.hover.background');
    }

    .p-toast-message-error {
        background: dt('toast.error.background');
        border-color: dt('toast.error.border.color');
        color: dt('toast.error.color');
        box-shadow: dt('toast.error.shadow');
    }

    .p-toast-message-error .p-toast-detail {
        color: dt('toast.error.detail.color');
    }

    .p-toast-message-error .p-toast-close-button:focus-visible {
        outline-color: dt('toast.error.close.button.focus.ring.color');
        box-shadow: dt('toast.error.close.button.focus.ring.shadow');
    }

    .p-toast-message-error .p-toast-close-button:hover {
        background: dt('toast.error.close.button.hover.background');
    }

    .p-toast-message-secondary {
        background: dt('toast.secondary.background');
        border-color: dt('toast.secondary.border.color');
        color: dt('toast.secondary.color');
        box-shadow: dt('toast.secondary.shadow');
    }

    .p-toast-message-secondary .p-toast-detail {
        color: dt('toast.secondary.detail.color');
    }

    .p-toast-message-secondary .p-toast-close-button:focus-visible {
        outline-color: dt('toast.secondary.close.button.focus.ring.color');
        box-shadow: dt('toast.secondary.close.button.focus.ring.shadow');
    }

    .p-toast-message-secondary .p-toast-close-button:hover {
        background: dt('toast.secondary.close.button.hover.background');
    }

    .p-toast-message-contrast {
        background: dt('toast.contrast.background');
        border-color: dt('toast.contrast.border.color');
        color: dt('toast.contrast.color');
        box-shadow: dt('toast.contrast.shadow');
    }
    
    .p-toast-message-contrast .p-toast-detail {
        color: dt('toast.contrast.detail.color');
    }

    .p-toast-message-contrast .p-toast-close-button:focus-visible {
        outline-color: dt('toast.contrast.close.button.focus.ring.color');
        box-shadow: dt('toast.contrast.close.button.focus.ring.shadow');
    }

    .p-toast-message-contrast .p-toast-close-button:hover {
        background: dt('toast.contrast.close.button.hover.background');
    }

    .p-toast-top-center {
        transform: translateX(-50%);
    }

    .p-toast-bottom-center {
        transform: translateX(-50%);
    }

    .p-toast-center {
        min-width: 20vw;
        transform: translate(-50%, -50%);
    }

    .p-toast-message-enter-active {
        animation: p-animate-toast-enter 300ms ease-out;
    }

    .p-toast-message-leave-active {
        animation: p-animate-toast-leave 250ms ease-in;
    }

    .p-toast-message-leave-to .p-toast-message-content {
        padding-top: 0;
        padding-bottom: 0;
    }

    @keyframes p-animate-toast-enter {
        from {
            opacity: 0;
            transform: scale(0.6);
        }
        to {
            opacity: 1;
            grid-template-rows: 1fr;
        }
    }

     @keyframes p-animate-toast-leave {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
            margin-bottom: 0;
            grid-template-rows: 0fr;
            transform: translateY(-100%) scale(0.6);
        }
    }
`;var Qt=(t,i)=>({$implicit:t,closeFn:i}),$t=t=>({$implicit:t});function qt(t,i){t&1&&k(0)}function Ht(t,i){if(t&1&&g(0,qt,1,0,"ng-container",3),t&2){let e=r();s("ngTemplateOutlet",e.headlessTemplate)("ngTemplateOutletContext",Ae(2,Qt,e.message,e.onCloseIconClick))}}function Gt(t,i){if(t&1&&f(0,"span",4),t&2){let e=r(3);m(e.cn(e.cx("messageIcon"),e.message==null?null:e.message.icon)),s("pBind",e.ptm("messageIcon"))}}function Xt(t,i){if(t&1&&(I(),f(0,"svg",11)),t&2){let e=r(4);m(e.cx("messageIcon")),s("pBind",e.ptm("messageIcon")),u("aria-hidden",!0)}}function Kt(t,i){if(t&1&&(I(),f(0,"svg",12)),t&2){let e=r(4);m(e.cx("messageIcon")),s("pBind",e.ptm("messageIcon")),u("aria-hidden",!0)}}function Wt(t,i){if(t&1&&(I(),f(0,"svg",13)),t&2){let e=r(4);m(e.cx("messageIcon")),s("pBind",e.ptm("messageIcon")),u("aria-hidden",!0)}}function Yt(t,i){if(t&1&&(I(),f(0,"svg",14)),t&2){let e=r(4);m(e.cx("messageIcon")),s("pBind",e.ptm("messageIcon")),u("aria-hidden",!0)}}function Ut(t,i){if(t&1&&(I(),f(0,"svg",12)),t&2){let e=r(4);m(e.cx("messageIcon")),s("pBind",e.ptm("messageIcon")),u("aria-hidden",!0)}}function Jt(t,i){if(t&1&&A(0,Xt,1,4,":svg:svg",7)(1,Kt,1,4,":svg:svg",8)(2,Wt,1,4,":svg:svg",9)(3,Yt,1,4,":svg:svg",10)(4,Ut,1,4,":svg:svg",8),t&2){let e,o=r(3);B((e=o.message.severity)==="success"?0:e==="info"?1:e==="error"?2:e==="warn"?3:4)}}function en(t,i){if(t&1&&(Y(0),A(1,Gt,1,3,"span",2)(2,Jt,5,1),c(3,"div",6)(4,"div",6),h(5),d(),c(6,"div",6),h(7),d()(),U()),t&2){let e=r(2);a(),B(e.message.icon?1:2),a(2),s("pBind",e.ptm("messageText"))("ngClass",e.cx("messageText")),u("data-p",e.dataP),a(),s("pBind",e.ptm("summary"))("ngClass",e.cx("summary")),u("data-p",e.dataP),a(),ee(" ",e.message.summary," "),a(),s("pBind",e.ptm("detail"))("ngClass",e.cx("detail")),u("data-p",e.dataP),a(),D(e.message.detail)}}function tn(t,i){t&1&&k(0)}function nn(t,i){if(t&1&&f(0,"span",4),t&2){let e=r(4);m(e.cn(e.cx("closeIcon"),e.message==null?null:e.message.closeIcon)),s("pBind",e.ptm("closeIcon"))}}function on(t,i){if(t&1&&g(0,nn,1,3,"span",17),t&2){let e=r(3);s("ngIf",e.message.closeIcon)}}function an(t,i){if(t&1&&(I(),f(0,"svg",18)),t&2){let e=r(3);m(e.cx("closeIcon")),s("pBind",e.ptm("closeIcon")),u("aria-hidden",!0)}}function sn(t,i){if(t&1){let e=J();c(0,"div")(1,"button",15),$("click",function(n){S(e);let l=r(2);return E(l.onCloseIconClick(n))})("keydown.enter",function(n){S(e);let l=r(2);return E(l.onCloseIconClick(n))}),A(2,on,1,1,"span",2)(3,an,1,4,":svg:svg",16),d()()}if(t&2){let e=r(2);a(),s("pBind",e.ptm("closeButton")),u("class",e.cx("closeButton"))("aria-label",e.closeAriaLabel)("data-p",e.dataP),a(),B(e.message.closeIcon?2:3)}}function rn(t,i){if(t&1&&(c(0,"div",4),g(1,en,8,12,"ng-container",5)(2,tn,1,0,"ng-container",3),A(3,sn,4,5,"div"),d()),t&2){let e=r();m(e.cn(e.cx("messageContent"),e.message==null?null:e.message.contentStyleClass)),s("pBind",e.ptm("messageContent")),a(),s("ngIf",!e.template),a(),s("ngTemplateOutlet",e.template)("ngTemplateOutletContext",Ee(7,$t,e.message)),a(),B((e.message==null?null:e.message.closable)!==!1?3:-1)}}var ln=["message"],cn=["headless"];function dn(t,i){if(t&1){let e=J();c(0,"p-toastItem",1),$("onClose",function(n){S(e);let l=r();return E(l.onMessageClose(n))})("onAnimationEnd",function(){S(e);let n=r();return E(n.onAnimationEnd())})("onAnimationStart",function(){S(e);let n=r();return E(n.onAnimationStart())}),d()}if(t&2){let e=i.$implicit,o=i.index,n=r();s("message",e)("index",o)("life",n.life)("clearAll",n.clearAllTrigger())("template",n.template||n._template)("headlessTemplate",n.headlessTemplate||n._headlessTemplate)("pt",n.pt)("unstyled",n.unstyled())("motionOptions",n.computedMotionOptions())}}var pn={root:({instance:t})=>{let{_position:i}=t;return{position:"fixed",top:i==="top-right"||i==="top-left"||i==="top-center"?"20px":i==="center"?"50%":null,right:(i==="top-right"||i==="bottom-right")&&"20px",bottom:(i==="bottom-left"||i==="bottom-right"||i==="bottom-center")&&"20px",left:i==="top-left"||i==="bottom-left"?"20px":i==="center"||i==="top-center"||i==="bottom-center"?"50%":null}}},mn={root:({instance:t})=>["p-toast p-component",`p-toast-${t._position}`],message:({instance:t})=>({"p-toast-message":!0,"p-toast-message-info":t.message.severity==="info"||t.message.severity===void 0,"p-toast-message-warn":t.message.severity==="warn","p-toast-message-error":t.message.severity==="error","p-toast-message-success":t.message.severity==="success","p-toast-message-secondary":t.message.severity==="secondary","p-toast-message-contrast":t.message.severity==="contrast"}),messageContent:"p-toast-message-content",messageIcon:({instance:t})=>({"p-toast-message-icon":!0,[`pi ${t.message.icon}`]:!!t.message.icon}),messageText:"p-toast-message-text",summary:"p-toast-summary",detail:"p-toast-detail",closeButton:"p-toast-close-button",closeIcon:({instance:t})=>({"p-toast-close-icon":!0,[`pi ${t.message.closeIcon}`]:!!t.message.closeIcon})},fe=(()=>{class t extends X{name="toast";style=mt;classes=mn;inlineStyles=pn;static \u0275fac=(()=>{let e;return function(n){return(e||(e=x(t)))(n||t)}})();static \u0275prov=P({token:t,factory:t.\u0275fac})}return t})();var ut=new z("TOAST_INSTANCE"),un=(()=>{class t extends F{zone;message;index;life;template;headlessTemplate;showTransformOptions;hideTransformOptions;showTransitionOptions;hideTransitionOptions;motionOptions=se();clearAll=se(null);onAnimationStart=_e();onAnimationEnd=_e();onBeforeEnter(e){this.onAnimationStart.emit(e.element)}onAfterLeave(e){!this.visible()&&!this.isDestroyed&&(this.onClose.emit({index:this.index,message:this.message}),this.isDestroyed||this.onAnimationEnd.emit(e.element))}onClose=new he;_componentStyle=_(fe);timeout;visible=W(void 0);isDestroyed=!1;isClosing=!1;constructor(e){super(),this.zone=e,Ce(()=>{this.clearAll()&&this.visible.set(!1)})}onAfterViewInit(){this.message?.sticky&&this.visible.set(!0),this.initTimeout()}initTimeout(){this.message?.sticky||(this.clearTimeout(),this.zone.runOutsideAngular(()=>{this.visible.set(!0),this.timeout=setTimeout(()=>{this.visible.set(!1)},this.message?.life||this.life||3e3)}))}clearTimeout(){this.timeout&&(clearTimeout(this.timeout),this.timeout=null)}onMouseEnter(){this.clearTimeout()}onMouseLeave(){this.isClosing||this.initTimeout()}onCloseIconClick=e=>{this.isClosing=!0,this.clearTimeout(),this.visible.set(!1),e.preventDefault()};get closeAriaLabel(){return this.config.translation.aria?this.config.translation.aria.close:void 0}onDestroy(){this.isDestroyed=!0,this.clearTimeout(),this.visible.set(!1)}get dataP(){return this.cn({[this.message?.severity]:this.message?.severity})}static \u0275fac=function(o){return new(o||t)(ve(be))};static \u0275cmp=b({type:t,selectors:[["p-toastItem"]],inputs:{message:"message",index:[2,"index","index",te],life:[2,"life","life",te],template:"template",headlessTemplate:"headlessTemplate",showTransformOptions:"showTransformOptions",hideTransformOptions:"hideTransformOptions",showTransitionOptions:"showTransitionOptions",hideTransitionOptions:"hideTransitionOptions",motionOptions:[1,"motionOptions"],clearAll:[1,"clearAll"]},outputs:{onAnimationStart:"onAnimationStart",onAnimationEnd:"onAnimationEnd",onClose:"onClose"},features:[M([fe]),w],decls:4,vars:10,consts:[["container",""],["role","alert","aria-live","assertive","aria-atomic","true",3,"pMotionOnBeforeEnter","pMotionOnAfterLeave","mouseenter","mouseleave","pMotion","pMotionAppear","pMotionName","pMotionOptions","pBind"],[3,"pBind","class"],[4,"ngTemplateOutlet","ngTemplateOutletContext"],[3,"pBind"],[4,"ngIf"],[3,"pBind","ngClass"],["data-p-icon","check",3,"pBind","class"],["data-p-icon","info-circle",3,"pBind","class"],["data-p-icon","times-circle",3,"pBind","class"],["data-p-icon","exclamation-triangle",3,"pBind","class"],["data-p-icon","check",3,"pBind"],["data-p-icon","info-circle",3,"pBind"],["data-p-icon","times-circle",3,"pBind"],["data-p-icon","exclamation-triangle",3,"pBind"],["type","button","autofocus","",3,"click","keydown.enter","pBind"],["data-p-icon","times",3,"pBind","class"],[3,"pBind","class",4,"ngIf"],["data-p-icon","times",3,"pBind"]],template:function(o,n){o&1&&(c(0,"div",1,0),$("pMotionOnBeforeEnter",function(p){return n.onBeforeEnter(p)})("pMotionOnAfterLeave",function(p){return n.onAfterLeave(p)})("mouseenter",function(){return n.onMouseEnter()})("mouseleave",function(){return n.onMouseLeave()}),A(2,Ht,1,5,"ng-container")(3,rn,4,9,"div",2),d()),o&2&&(m(n.cn(n.cx("message"),n.message==null?null:n.message.styleClass)),s("pMotion",n.visible())("pMotionAppear",!0)("pMotionName","p-toast-message")("pMotionOptions",n.motionOptions())("pBind",n.ptm("message")),u("id",n.message==null?null:n.message.id)("data-p",n.dataP),a(2),B(n.headlessTemplate?2:3))},dependencies:[O,De,le,ce,$e,st,rt,qe,He,T,y,We,Ke],encapsulation:2,changeDetection:0})}return t})(),fn=(()=>{class t extends F{componentName="Toast";$pcToast=_(ut,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=_(y,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}key;autoZIndex=!0;baseZIndex=0;life=3e3;styleClass;get position(){return this._position}set position(e){this._position=e,this.cd.markForCheck()}preventOpenDuplicates=!1;preventDuplicates=!1;showTransformOptions="translateY(100%)";hideTransformOptions="translateY(-100%)";showTransitionOptions="300ms ease-out";hideTransitionOptions="250ms ease-in";motionOptions=se(void 0);computedMotionOptions=Be(()=>N(N({},this.ptm("motion")),this.motionOptions()));breakpoints;onClose=new he;template;headlessTemplate;messageSubscription;clearSubscription;messages;messagesArchieve;_position="top-right";messageService=_(de);_componentStyle=_(fe);styleElement;id=H("pn_id_");templates;clearAllTrigger=W(null);constructor(){super()}onInit(){this.messageSubscription=this.messageService.messageObserver.subscribe(e=>{if(e)if(Array.isArray(e)){let o=e.filter(n=>this.canAdd(n));this.add(o)}else this.canAdd(e)&&this.add([e])}),this.clearSubscription=this.messageService.clearObserver.subscribe(e=>{e?this.key===e&&this.clearAll():this.clearAll(),this.cd.markForCheck()})}clearAll(){this.clearAllTrigger.set({})}_template;_headlessTemplate;onAfterContentInit(){this.templates?.forEach(e=>{switch(e.getType()){case"message":this._template=e.template;break;case"headless":this._headlessTemplate=e.template;break;default:this._template=e.template;break}})}onAfterViewInit(){this.breakpoints&&this.createStyle()}add(e){this.messages=this.messages?[...this.messages,...e]:[...e],this.preventDuplicates&&(this.messagesArchieve=this.messagesArchieve?[...this.messagesArchieve,...e]:[...e]),this.cd.markForCheck()}canAdd(e){let o=this.key===e.key;return o&&this.preventOpenDuplicates&&(o=!this.containsMessage(this.messages,e)),o&&this.preventDuplicates&&(o=!this.containsMessage(this.messagesArchieve,e)),o}containsMessage(e,o){return e?e.find(n=>n.summary===o.summary&&n.detail==o.detail&&n.severity===o.severity)!=null:!1}onMessageClose(e){this.messages?.splice(e.index,1),this.onClose.emit({message:e.message}),this.onAnimationEnd(),this.cd.detectChanges()}onAnimationStart(){this.renderer.setAttribute(this.el?.nativeElement,this.id,""),this.autoZIndex&&this.el?.nativeElement.style.zIndex===""&&me.set("modal",this.el?.nativeElement,this.baseZIndex||this.config.zIndex.modal)}onAnimationEnd(){this.autoZIndex&&Pe(this.messages)&&me.clear(this.el?.nativeElement)}createStyle(){if(!this.styleElement){this.styleElement=this.renderer.createElement("style"),this.styleElement.type="text/css",ye(this.styleElement,"nonce",this.config?.csp()?.nonce),this.renderer.appendChild(this.document.head,this.styleElement);let e="";for(let o in this.breakpoints){let n="";for(let l in this.breakpoints[o])n+=l+":"+this.breakpoints[o][l]+" !important;";e+=`
                    @media screen and (max-width: ${o}) {
                        .p-toast[${this.id}] {
                           ${n}
                        }
                    }
                `}this.renderer.setProperty(this.styleElement,"innerHTML",e),ye(this.styleElement,"nonce",this.config?.csp()?.nonce)}}destroyStyle(){this.styleElement&&(this.renderer.removeChild(this.document.head,this.styleElement),this.styleElement=null)}onDestroy(){this.messageSubscription&&this.messageSubscription.unsubscribe(),this.el&&this.autoZIndex&&me.clear(this.el.nativeElement),this.clearSubscription&&this.clearSubscription.unsubscribe(),this.destroyStyle()}get dataP(){return this.cn({[this.position]:this.position})}static \u0275fac=function(o){return new(o||t)};static \u0275cmp=b({type:t,selectors:[["p-toast"]],contentQueries:function(o,n,l){if(o&1&&ae(l,ln,5)(l,cn,5)(l,G,4),o&2){let p;C(p=v())&&(n.template=p.first),C(p=v())&&(n.headlessTemplate=p.first),C(p=v())&&(n.templates=p)}},hostVars:5,hostBindings:function(o,n){o&2&&(u("data-p",n.dataP),q(n.sx("root")),m(n.cn(n.cx("root"),n.styleClass)))},inputs:{key:"key",autoZIndex:[2,"autoZIndex","autoZIndex",re],baseZIndex:[2,"baseZIndex","baseZIndex",te],life:[2,"life","life",te],styleClass:"styleClass",position:"position",preventOpenDuplicates:[2,"preventOpenDuplicates","preventOpenDuplicates",re],preventDuplicates:[2,"preventDuplicates","preventDuplicates",re],showTransformOptions:"showTransformOptions",hideTransformOptions:"hideTransformOptions",showTransitionOptions:"showTransitionOptions",hideTransitionOptions:"hideTransitionOptions",motionOptions:[1,"motionOptions"],breakpoints:"breakpoints"},outputs:{onClose:"onClose"},features:[M([fe,{provide:ut,useExisting:t},{provide:K,useExisting:t}]),L([y]),w],decls:1,vars:1,consts:[[3,"message","index","life","clearAll","template","headlessTemplate","pt","unstyled","motionOptions","onClose","onAnimationEnd","onAnimationStart",4,"ngFor","ngForOf"],[3,"onClose","onAnimationEnd","onAnimationStart","message","index","life","clearAll","template","headlessTemplate","pt","unstyled","motionOptions"]],template:function(o,n){o&1&&g(0,dn,1,9,"p-toastItem",0),o&2&&s("ngForOf",n.messages)},dependencies:[O,Oe,un,T],encapsulation:2,changeDetection:0})}return t})(),ft=(()=>{class t{static \u0275fac=function(o){return new(o||t)};static \u0275mod=R({type:t});static \u0275inj=V({imports:[fn,T,T]})}return t})();function gn(t,i){if(t&1&&(c(0,"div",17)(1,"span",18),h(2),d(),f(3,"p-tag",19),d()),t&2){let e=r().$implicit,o=r();a(2),D(e.name),a(),s("value",e.category)("severity",o.getSeverity(e.category))("styleClass","text-xs")}}function hn(t,i){if(t&1&&(c(0,"p",20),h(1),d(),c(2,"div",21)(3,"span",22),f(4,"i",23),h(5),d(),c(6,"span",22),f(7,"i",24),h(8),d()()),t&2){let e=r().$implicit;a(),D(e.description),a(4),ee("",e.rating||"0.0"," "),a(3),ee("",e.downloads||0," installs ")}}function _n(t,i){if(t&1){let e=J();c(0,"div",25)(1,"a",26),f(2,"i",27),h(3,"Details "),d(),c(4,"button",28),$("click",function(){S(e);let n=r().$implicit,l=r();return E(l.installPlugin(n))}),d()()}if(t&2){let e=r().$implicit;a(),s("routerLink","/intelligence/plugins/"+e.id)}}function yn(t,i){t&1&&(c(0,"div",11)(1,"div",13),g(2,gn,4,4,"ng-template",14)(3,hn,9,3,"ng-template",15)(4,_n,5,1,"ng-template",16),d()())}function bn(t,i){t&1&&(c(0,"div",12),f(1,"i",29),c(2,"p",3),h(3,"No plugins found matching your search."),d()())}var gt=class t{searchTerm="";plugins=[{id:"health-checker",name:"Health Checker",category:"Monitoring",description:"Advanced health monitoring with custom thresholds",rating:4.8,downloads:1250},{id:"cost-optimizer",name:"Cost Optimizer",category:"Cost",description:"Automated right-sizing recommendations",rating:4.6,downloads:980},{id:"security-scanner",name:"Security Scanner",category:"Security",description:"Deep security posture analysis",rating:4.9,downloads:1420},{id:"cluster-backup",name:"Cluster Backup",category:"Backup",description:"Automated etcd and config backups",rating:4.5,downloads:670},{id:"alert-forwarder",name:"Alert Forwarder",category:"Notifications",description:"Forward alerts to Slack, PagerDuty, Teams",rating:4.7,downloads:890},{id:"resource-trend",name:"Resource Trends",category:"Analytics",description:"7-day resource usage forecasting",rating:4.4,downloads:540},{id:"network-map",name:"Network Map",category:"Networking",description:"Visualize service dependencies and traffic",rating:4.8,downloads:760},{id:"log-analyzer",name:"Log Analyzer",category:"Observability",description:"Pattern detection in application logs",rating:4.6,downloads:620},{id:"policy-enforcer",name:"Policy Enforcer",category:"Governance",description:"Kubernetes policy compliance checks",rating:4.7,downloads:830},{id:"secret-rotator",name:"Secret Rotator",category:"Security",description:"Automated rotation for secrets and credentials",rating:4.5,downloads:410}];get filteredPlugins(){if(!this.searchTerm)return this.plugins;let i=this.searchTerm.toLowerCase();return this.plugins.filter(e=>e.name.toLowerCase().includes(i)||e.description.toLowerCase().includes(i)||e.category.toLowerCase().includes(i))}getSeverity(i){return{Monitoring:"info",Cost:"success",Security:"danger",Backup:"warning",Notifications:"info",Analytics:"secondary",Networking:"info",Observability:"secondary",Governance:"warning",DevTools:"success"}[i]||"secondary"}installPlugin(i){console.log("Installing plugin:",i.name)}static \u0275fac=function(e){return new(e||t)};static \u0275cmp=b({type:t,selectors:[["app-plugins"]],features:[M([de])],decls:18,vars:2,consts:[[1,"p-4"],[1,"flex","justify-content-between","align-items-center","mb-4"],[1,"text-2xl","font-bold"],[1,"text-muted-color"],["routerLink","/intelligence/settings",1,"p-button-text"],[1,"pi","pi-cog","mr-2"],[1,"mb-4"],[1,"p-input-icon-left","w-full","md:w-30rem"],[1,"pi","pi-search"],["type","text","pInputText","","placeholder","Search plugins...",1,"w-full",3,"ngModelChange","ngModel"],[1,"grid"],[1,"col-12","md:col-6","lg:col-4"],[1,"text-center","py-8"],["pCard","",1,"h-full"],["pTemplate","header"],["pTemplate","body"],["pTemplate","footer"],[1,"flex","justify-content-between","align-items-center"],[1,"font-bold","text-lg"],[3,"value","severity","styleClass"],[1,"m-0","text-sm","text-muted-color"],[1,"flex","flex-wrap","gap-2","mt-3"],[1,"flex","align-items-center","text-xs"],[1,"pi","pi-star","mr-1"],[1,"pi","pi-download","mr-1"],[1,"flex","gap-2"],[1,"p-button-text","p-button-sm",3,"routerLink"],[1,"pi","pi-info-circle","mr-2"],["pButton","","pRipple","","label","Install","icon","pi pi-download",1,"p-button-sm","p-button-outlined",3,"click"],[1,"pi","pi-search","pi-4x","mb-3","text-muted-color"]],template:function(e,o){e&1&&(c(0,"div",0)(1,"div",1)(2,"div")(3,"h1",2),h(4,"Plugins"),d(),c(5,"p",3),h(6,"Discover and install community extensions"),d()(),c(7,"a",4),f(8,"i",5),h(9,"Settings "),d()(),c(10,"div",6)(11,"span",7),f(12,"i",8),c(13,"input",9),Se("ngModelChange",function(l){return Me(o.searchTerm,l)||(o.searchTerm=l),l}),d()()(),c(14,"div",10),xe(15,yn,5,0,"div",11,Te),d(),A(17,bn,4,0,"div",12),d()),e&2&&(a(13),ke("ngModel",o.searchTerm),a(2),Ie(o.filteredPlugins),a(2),B(o.filteredPlugins.length===0?17:-1))},dependencies:[Qe,Le,je,Ze,Ne,Fe,at,G,Ue,Ye,Xe,Ge,et,Je,pt,ft],encapsulation:2})};export{gt as PluginsComponent};
