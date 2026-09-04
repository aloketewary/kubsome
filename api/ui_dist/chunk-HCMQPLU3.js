import{a as Pe,b as ze}from"./chunk-DPM5BKKO.js";import{a as Oe,b as Ae}from"./chunk-I6YRAZLQ.js";import{a as Te,c as Me,d as Ie}from"./chunk-SFQGNW57.js";import{a as Ee,b as De,c as Se}from"./chunk-WUSVZFIE.js";import{b as A}from"./chunk-U5EAHB4L.js";import{b as Ce,c as ke}from"./chunk-SHVRSAY4.js";import{S as Q,Z as B,_ as N,ia as ve,ka as xe,l as F,la as ye,ma as O,n as we,z as R}from"./chunk-K3UHJ75B.js";import{e as he,g as _e,i as ge,o as be}from"./chunk-ASI5HLN6.js";import{$ as y,$a as K,Ac as fe,Cb as T,Eb as p,Fb as ne,Gb as ie,Hb as re,I as Z,Ia as o,Ib as ae,J as q,Jb as h,Kb as _,L as H,N as P,Pb as oe,Qb as L,Rb as E,Sb as c,T as g,Tb as w,U as b,Ub as se,V as G,Wa as z,Xa as W,Xb as le,Yb as de,Zb as pe,_a as J,ab as u,ac as ce,cc as me,hb as x,ib as C,ja as $,jb as k,jc as ue,kb as U,mb as X,nb as Y,nc as D,ob as d,pb as a,qb as s,rb as f,rc as S,vb as ee,wb as te,xb as M,yb as I,zc as v}from"./chunk-IFA4XUDI.js";import{a as V}from"./chunk-VG67F64M.js";var Le=`
    .p-drawer {
        display: flex;
        flex-direction: column;
        transform: translate3d(0px, 0px, 0px);
        position: relative;
        transition: transform 0.3s;
        background: dt('drawer.background');
        color: dt('drawer.color');
        border-style: solid;
        border-color: dt('drawer.border.color');
        box-shadow: dt('drawer.shadow');
    }

    .p-drawer-content {
        overflow-y: auto;
        flex-grow: 1;
        padding: dt('drawer.content.padding');
    }

    .p-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        padding: dt('drawer.header.padding');
    }

    .p-drawer-footer {
        padding: dt('drawer.footer.padding');
    }

    .p-drawer-title {
        font-weight: dt('drawer.title.font.weight');
        font-size: dt('drawer.title.font.size');
    }

    .p-drawer-full .p-drawer {
        transition: none;
        transform: none;
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100%;
        top: 0px !important;
        left: 0px !important;
        border-width: 1px;
    }

    .p-drawer-left .p-drawer-enter-active {
        animation: p-animate-drawer-enter-left 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .p-drawer-left .p-drawer-leave-active {
        animation: p-animate-drawer-leave-left 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .p-drawer-right .p-drawer-enter-active {
        animation: p-animate-drawer-enter-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .p-drawer-right .p-drawer-leave-active {
        animation: p-animate-drawer-leave-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .p-drawer-top .p-drawer-enter-active {
        animation: p-animate-drawer-enter-top 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .p-drawer-top .p-drawer-leave-active {
        animation: p-animate-drawer-leave-top 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .p-drawer-bottom .p-drawer-enter-active {
        animation: p-animate-drawer-enter-bottom 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .p-drawer-bottom .p-drawer-leave-active {
        animation: p-animate-drawer-leave-bottom 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }

    .p-drawer-full .p-drawer-enter-active {
        animation: p-animate-drawer-enter-full 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .p-drawer-full .p-drawer-leave-active {
        animation: p-animate-drawer-leave-full 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    }
    
    .p-drawer-left .p-drawer {
        width: 20rem;
        height: 100%;
        border-inline-end-width: 1px;
    }

    .p-drawer-right .p-drawer {
        width: 20rem;
        height: 100%;
        border-inline-start-width: 1px;
    }

    .p-drawer-top .p-drawer {
        height: 10rem;
        width: 100%;
        border-block-end-width: 1px;
    }

    .p-drawer-bottom .p-drawer {
        height: 10rem;
        width: 100%;
        border-block-start-width: 1px;
    }

    .p-drawer-left .p-drawer-content,
    .p-drawer-right .p-drawer-content,
    .p-drawer-top .p-drawer-content,
    .p-drawer-bottom .p-drawer-content {
        width: 100%;
        height: 100%;
    }

    .p-drawer-open {
        display: flex;
    }

    .p-drawer-mask:dir(rtl) {
        flex-direction: row-reverse;
    }

    @keyframes p-animate-drawer-enter-left {
        from {
            transform: translate3d(-100%, 0px, 0px);
        }
    }

    @keyframes p-animate-drawer-leave-left {
        to {
            transform: translate3d(-100%, 0px, 0px);
        }
    }

    @keyframes p-animate-drawer-enter-right {
        from {
            transform: translate3d(100%, 0px, 0px);
        }
    }

    @keyframes p-animate-drawer-leave-right {
        to {
            transform: translate3d(100%, 0px, 0px);
        }
    }

    @keyframes p-animate-drawer-enter-top {
        from {
            transform: translate3d(0px, -100%, 0px);
        }
    }

    @keyframes p-animate-drawer-leave-top {
        to {
            transform: translate3d(0px, -100%, 0px);
        }
    }

    @keyframes p-animate-drawer-enter-bottom {
        from {
            transform: translate3d(0px, 100%, 0px);
        }
    }

    @keyframes p-animate-drawer-leave-bottom {
        to {
            transform: translate3d(0px, 100%, 0px);
        }
    }

    @keyframes p-animate-drawer-enter-full {
        from {
            opacity: 0;
            transform: scale(0.93);
        }
    }

    @keyframes p-animate-drawer-leave-full {
        to {
            opacity: 0;
            transform: scale(0.93);
        }
    }
`;var Re=["header"],Qe=["footer"],je=["content"],Ze=["closeicon"],qe=["headless"],He=["container"],Ge=["closeButton"],We=["*"];function Je(t,l){t&1&&M(0)}function Ke(t,l){if(t&1&&u(0,Je,1,0,"ng-container",4),t&2){let e=p(2);d("ngTemplateOutlet",e.headlessTemplate||e._headlessTemplate)}}function Ue(t,l){t&1&&M(0)}function Xe(t,l){if(t&1&&(a(0,"div",9),c(1),s()),t&2){let e=p(3);E(e.cx("title")),d("pBind",e.ptm("title")),o(),w(e.header)}}function Ye(t,l){t&1&&(G(),f(0,"svg",12)),t&2&&x("data-pc-section","closeicon")}function et(t,l){}function tt(t,l){t&1&&u(0,et,0,0,"ng-template")}function nt(t,l){if(t&1&&u(0,Ye,1,1,"svg",11)(1,tt,1,0,null,4),t&2){let e=p(4);d("ngIf",!e.closeIconTemplate&&!e._closeIconTemplate),o(),d("ngTemplateOutlet",e.closeIconTemplate||e._closeIconTemplate)}}function it(t,l){if(t&1){let e=I();a(0,"p-button",10),T("onClick",function(i){g(e);let r=p(3);return b(r.close(i))})("keydown.enter",function(i){g(e);let r=p(3);return b(r.close(i))}),u(1,nt,2,2,"ng-template",null,1,ue),s()}if(t&2){let e=p(3);d("pt",e.ptm("pcCloseButton"))("ngClass",e.cx("pcCloseButton"))("buttonProps",e.closeButtonProps)("ariaLabel",e.ariaCloseLabel)("unstyled",e.unstyled()),x("data-pc-group-section","iconcontainer")}}function rt(t,l){t&1&&M(0)}function at(t,l){t&1&&M(0)}function ot(t,l){if(t&1&&(ee(0),a(1,"div",5),u(2,at,1,0,"ng-container",4),s(),te()),t&2){let e=p(3);o(),d("pBind",e.ptm("footer"))("ngClass",e.cx("footer")),x("data-pc-section","footer"),o(),d("ngTemplateOutlet",e.footerTemplate||e._footerTemplate)}}function st(t,l){if(t&1&&(a(0,"div",5),u(1,Ue,1,0,"ng-container",4)(2,Xe,2,4,"div",6)(3,it,3,6,"p-button",7),s(),a(4,"div",5),ie(5),u(6,rt,1,0,"ng-container",4),s(),u(7,ot,3,4,"ng-container",8)),t&2){let e=p(2);d("pBind",e.ptm("header"))("ngClass",e.cx("header")),x("data-pc-section","header"),o(),d("ngTemplateOutlet",e.headerTemplate||e._headerTemplate),o(),d("ngIf",e.header),o(),d("ngIf",e.showCloseIcon&&e.closable),o(),d("pBind",e.ptm("content"))("ngClass",e.cx("content")),x("data-pc-section","content"),o(2),d("ngTemplateOutlet",e.contentTemplate||e._contentTemplate),o(),d("ngIf",e.footerTemplate||e._footerTemplate)}}function lt(t,l){if(t&1){let e=I();a(0,"div",3,0),T("pMotionOnBeforeEnter",function(i){g(e);let r=p();return b(r.onBeforeEnter(i))})("pMotionOnAfterLeave",function(i){g(e);let r=p();return b(r.onAfterLeave(i))})("keydown",function(i){g(e);let r=p();return b(r.onKeyDown(i))}),C(2,Ke,1,1,"ng-container")(3,st,8,11),s()}if(t&2){let e=p();L(e.style),E(e.cn(e.cx("root"),e.styleClass)),d("pBind",e.ptm("root"))("pMotion",e.visible)("pMotionAppear",!0)("pMotionEnterActiveClass",e.$enterAnimation())("pMotionLeaveActiveClass",e.$leaveAnimation())("pMotionOptions",e.computedMotionOptions()),x("data-p",e.dataP)("data-p-open",e.visible),o(2),k(e.headlessTemplate||e._headlessTemplate?2:3)}}var dt=`
${Le}

/** For PrimeNG **/
.p-drawer {
    position: fixed;
}

.p-drawer-left {
    top: 0;
    left: 0;
    width: 20rem;
    height: 100%;
    border-inline-end-width: 1px;
}

.p-drawer-right {
    top: 0;
    right: 0;
    width: 20rem;
    height: 100%;
    border-inline-start-width: 1px;
}

.p-drawer-top {
    top: 0;
    left: 0;
    width: 100%;
    height: 10rem;
    border-block-end-width: 1px;
}

.p-drawer-bottom {
    bottom: 0;
    left: 0;
    width: 100%;
    height: 10rem;
    border-block-start-width: 1px;
}

.p-drawer-full {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    -webkit-transition: none;
    transition: none;
}

/* Animations */
.p-drawer-enter-left {
    animation: p-animate-drawer-enter-left 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-leave-left {
    animation: p-animate-drawer-leave-left 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-enter-right {
    animation: p-animate-drawer-enter-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-leave-right {
    animation: p-animate-drawer-leave-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-enter-top {
    animation: p-animate-drawer-enter-top 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-leave-top {
    animation: p-animate-drawer-leave-top 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-enter-bottom {
    animation: p-animate-drawer-enter-bottom 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-leave-bottom {
    animation: p-animate-drawer-leave-bottom 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-enter-full {
    animation: p-animate-drawer-enter-full 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.p-drawer-leave-full {
    animation: p-animate-drawer-leave-full 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
`,pt={mask:({instance:t})=>["p-drawer-mask",{"p-overlay-mask p-overlay-mask-enter-active":t.modal},{"p-drawer-full":t.fullScreen()}],root:({instance:t})=>["p-drawer p-component",{"p-drawer-full":t.fullScreen(),"p-drawer-open":t.visible},`p-drawer-${t.position()}`],header:"p-drawer-header",title:"p-drawer-title",pcCloseButton:"p-drawer-close-button",content:"p-drawer-content",footer:"p-drawer-footer"},Be=(()=>{class t extends ve{name="drawer";style=dt;classes=pt;static \u0275fac=(()=>{let e;return function(i){return(e||(e=$(t)))(i||t)}})();static \u0275prov=Z({token:t,factory:t.\u0275fac})}return t})();var Ne=new H("DRAWER_INSTANCE"),j=(()=>{class t extends ye{componentName="Drawer";$pcDrawer=P(Ne,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=P(O,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptm("host"))}appendTo=S(void 0);motionOptions=S(void 0);computedMotionOptions=D(()=>V(V({},this.ptm("motion")),this.motionOptions()));blockScroll=!1;style;styleClass;ariaCloseLabel;autoZIndex=!0;baseZIndex=0;modal=!0;closeButtonProps={severity:"secondary",text:!0,rounded:!0};dismissible=!0;showCloseIcon=!0;closeOnEscape=!0;transitionOptions="150ms cubic-bezier(0, 0, 0.2, 1)";get visible(){return this._visible??!1}set visible(e){this._visible=e,this._visible&&!this.modalVisible&&(this.modalVisible=!0)}position=S("left");fullScreen=S(!1);$enterAnimation=D(()=>this.fullScreen()?"p-drawer-enter-full":`p-drawer-enter-${this.position()}`);$leaveAnimation=D(()=>this.fullScreen()?"p-drawer-leave-full":`p-drawer-leave-${this.position()}`);header;maskStyle;closable=!0;onShow=new y;onHide=new y;visibleChange=new y;containerViewChild;closeButtonViewChild;initialized;_visible;_position="left";_fullScreen=!1;modalVisible=!1;container;mask;maskClickListener;documentEscapeListener;animationEndListener;_componentStyle=P(Be);onAfterViewInit(){this.initialized=!0}headerTemplate;footerTemplate;contentTemplate;closeIconTemplate;headlessTemplate;$appendTo=D(()=>this.appendTo()||this.config.overlayAppendTo());_headerTemplate;_footerTemplate;_contentTemplate;_closeIconTemplate;_headlessTemplate;templates;onAfterContentInit(){this.templates?.forEach(e=>{switch(e.getType()){case"content":this._contentTemplate=e.template;break;case"header":this._headerTemplate=e.template;break;case"footer":this._footerTemplate=e.template;break;case"closeicon":this._closeIconTemplate=e.template;break;case"headless":this._headlessTemplate=e.template;break;default:this._contentTemplate=e.template;break}})}onKeyDown(e){e.code==="Escape"&&this.hide(!1)}show(){this.container?.setAttribute(this.$attrSelector,""),this.autoZIndex&&A.set("modal",this.container,this.baseZIndex||this.config.zIndex.modal),this.modal&&this.enableModality(),this.onShow.emit({}),this.visibleChange.emit(!0)}hide(e=!0){e&&this.onHide.emit({}),this.modal&&this.disableModality()}close(e){this.hide(),this.visibleChange.emit(!1),this.cd.markForCheck(),e.preventDefault()}enableModality(){let e=this.document.querySelectorAll('[data-p-open="true"]'),n=e.length,i=n==1?String(parseInt(this.container.style.zIndex)-1):String(parseInt(e[n-1].style.zIndex)-1);if(!this.mask){if(this.mask=this.renderer.createElement("div"),this.mask){let r=`z-index: ${i};${this.getMaskStyle()}`;Q(this.mask,"style",r),Q(this.mask,"data-p",this.dataP),F(this.mask,this.cx("mask"))}this.dismissible&&(this.maskClickListener=this.renderer.listen(this.mask,"click",r=>{this.dismissible&&this.close(r)})),this.renderer.appendChild(this.document.body,this.mask),this.blockScroll&&Ce()}}getMaskStyle(){return this.maskStyle?Object.entries(this.maskStyle).map(([e,n])=>`${e}: ${n}`).join("; "):""}disableModality(){this.mask&&(!this.$unstyled()&&we(this.mask,"p-overlay-mask-enter-active"),!this.$unstyled()&&F(this.mask,"p-overlay-mask-leave-active"),this.animationEndListener=this.renderer.listen(this.mask,"animationend",this.destroyModal.bind(this)))}destroyModal(){this.unbindMaskClickListener(),this.mask&&this.renderer.removeChild(this.document.body,this.mask),this.blockScroll&&ke(),this.unbindAnimationEndListener(),this.mask=null}onBeforeEnter(e){this.container=e.element,this.appendContainer(),this.show(),this.closeOnEscape&&this.bindDocumentEscapeListener()}onAfterLeave(){this.hide(!1),A.clear(this.container),this.unbindGlobalListeners(),this.modalVisible=!1,this.container=null}appendContainer(){this.$appendTo()&&this.$appendTo()!=="self"&&(this.$appendTo()==="body"?R(this.document.body,this.container):R(this.$appendTo(),this.container))}bindDocumentEscapeListener(){let e=this.el?this.el.nativeElement.ownerDocument:this.document;this.documentEscapeListener=this.renderer.listen(e,"keydown",n=>{n.which==27&&parseInt(this.container?.style.zIndex)===A.get(this.container)&&this.close(n)})}unbindDocumentEscapeListener(){this.documentEscapeListener&&(this.documentEscapeListener(),this.documentEscapeListener=null)}unbindMaskClickListener(){this.maskClickListener&&(this.maskClickListener(),this.maskClickListener=null)}unbindGlobalListeners(){this.unbindMaskClickListener(),this.unbindDocumentEscapeListener()}unbindAnimationEndListener(){this.animationEndListener&&this.mask&&(this.animationEndListener(),this.animationEndListener=null)}onDestroy(){this.initialized=!1,this.visible&&this.modal&&this.destroyModal(),this.$appendTo()&&this.container&&this.renderer.appendChild(this.el.nativeElement,this.container),this.container&&this.autoZIndex&&A.clear(this.container),this.container=null,this.unbindGlobalListeners(),this.unbindAnimationEndListener()}get dataP(){return this.cn({"full-screen":this.position()==="full",[this.position()]:this.position(),open:this.visible,modal:this.modal})}static \u0275fac=(()=>{let e;return function(i){return(e||(e=$(t)))(i||t)}})();static \u0275cmp=z({type:t,selectors:[["p-drawer"]],contentQueries:function(n,i,r){if(n&1&&re(r,Re,4)(r,Qe,4)(r,je,4)(r,Ze,4)(r,qe,4)(r,B,4),n&2){let m;h(m=_())&&(i.headerTemplate=m.first),h(m=_())&&(i.footerTemplate=m.first),h(m=_())&&(i.contentTemplate=m.first),h(m=_())&&(i.closeIconTemplate=m.first),h(m=_())&&(i.headlessTemplate=m.first),h(m=_())&&(i.templates=m)}},viewQuery:function(n,i){if(n&1&&ae(He,5)(Ge,5),n&2){let r;h(r=_())&&(i.containerViewChild=r.first),h(r=_())&&(i.closeButtonViewChild=r.first)}},inputs:{appendTo:[1,"appendTo"],motionOptions:[1,"motionOptions"],blockScroll:[2,"blockScroll","blockScroll",v],style:"style",styleClass:"styleClass",ariaCloseLabel:"ariaCloseLabel",autoZIndex:[2,"autoZIndex","autoZIndex",v],baseZIndex:[2,"baseZIndex","baseZIndex",fe],modal:[2,"modal","modal",v],closeButtonProps:"closeButtonProps",dismissible:[2,"dismissible","dismissible",v],showCloseIcon:[2,"showCloseIcon","showCloseIcon",v],closeOnEscape:[2,"closeOnEscape","closeOnEscape",v],transitionOptions:"transitionOptions",visible:"visible",position:[1,"position"],fullScreen:[1,"fullScreen"],header:"header",maskStyle:"maskStyle",closable:[2,"closable","closable",v]},outputs:{onShow:"onShow",onHide:"onHide",visibleChange:"visibleChange"},features:[ce([Be,{provide:Ne,useExisting:t},{provide:xe,useExisting:t}]),J([O]),K],ngContentSelectors:We,decls:1,vars:1,consts:[["container",""],["icon",""],["role","complementary","pFocusTrap","",3,"pBind","pMotion","pMotionAppear","pMotionEnterActiveClass","pMotionLeaveActiveClass","pMotionOptions","class","style"],["role","complementary","pFocusTrap","",3,"pMotionOnBeforeEnter","pMotionOnAfterLeave","keydown","pBind","pMotion","pMotionAppear","pMotionEnterActiveClass","pMotionLeaveActiveClass","pMotionOptions"],[4,"ngTemplateOutlet"],[3,"pBind","ngClass"],[3,"pBind","class",4,"ngIf"],[3,"pt","ngClass","buttonProps","ariaLabel","unstyled","onClick","keydown.enter",4,"ngIf"],[4,"ngIf"],[3,"pBind"],[3,"onClick","keydown.enter","pt","ngClass","buttonProps","ariaLabel","unstyled"],["data-p-icon","times",4,"ngIf"],["data-p-icon","times"]],template:function(n,i){n&1&&(ne(),C(0,lt,4,13,"div",2)),n&2&&k(i.modalVisible?0:-1)},dependencies:[be,he,_e,ge,De,Te,N,O,ze,Pe,Ie,Me],encapsulation:2,changeDetection:0})}return t})(),Ve=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=W({type:t});static \u0275inj=q({imports:[j,N,N]})}return t})();var mt=t=>({width:t});function ut(t,l){if(t&1){let e=I();a(0,"div",5),f(1,"i",6),a(2,"div",7)(3,"h3"),c(4,"AI Diagnosis"),s(),a(5,"p"),c(6),s()(),a(7,"button",8),T("click",function(){g(e);let i=p();return b(i.fullscreen=!i.fullscreen)}),f(8,"i",9),s()()}if(t&2){let e=p();o(6),w(e.resourceName),o(),d("title",e.fullscreen?"Collapse":"Expand"),o(),oe("pi-window-minimize",e.fullscreen)("pi-expand",!e.fullscreen)}}function ft(t,l){t&1&&(a(0,"div",3),f(1,"div",10),a(2,"p"),c(3,"Analyzing resource events and logs..."),s()())}function ht(t,l){if(t&1&&(a(0,"div",17)(1,"div",18),f(2,"p-tag",19),a(3,"span",20),c(4),s()(),a(5,"p",21),c(6),s(),a(7,"div",22)(8,"span",23),c(9,"Recommendation:"),s(),a(10,"span",24),c(11),s()()()),t&2){let e=l.$implicit;E("severity-"+e.severity),o(2),d("value",e.severity)("severity",e.severity==="critical"?"danger":"warn")("rounded",!0),o(2),w(e.title),o(2),w(e.detail),o(5),w(e.action)}}function _t(t,l){t&1&&(a(0,"div",15),f(1,"i",25),a(2,"p"),c(3,"No critical issues detected by AI."),s()())}function gt(t,l){if(t&1&&(a(0,"div",11)(1,"div",12),c(2,"Summary"),s(),a(3,"div",13)(4,"p"),c(5),s()()(),a(6,"div",11)(7,"div",12),c(8,"Findings"),s(),X(9,ht,12,8,"div",14,U),C(11,_t,4,0,"div",15),s(),a(12,"div",11)(13,"div",12),c(14,"AI Reasoning"),s(),a(15,"div",16),c(16),s()()),t&2){let e=p();o(5),w(e.summary),o(4),Y(e.findings),o(2),k(e.findings.length===0?11:-1),o(5),se(" ",e.reasoning," ")}}function bt(t,l){if(t&1&&(a(0,"div",26),f(1,"button",27),s()),t&2){let e=p();o(),d("disabled",e.findings.length===0)}}var $e=class t{visible=!1;loading=!1;resourceName="";summary="";findings=[];reasoning="";closed=new y;fullscreen=!1;static \u0275fac=function(e){return new(e||t)};static \u0275cmp=z({type:t,selectors:[["app-ai-insight-drawer"]],inputs:{visible:"visible",loading:"loading",resourceName:"resourceName",summary:"summary",findings:"findings",reasoning:"reasoning"},outputs:{closed:"closed"},decls:6,vars:8,consts:[["position","right",3,"visibleChange","onHide","visible","appendTo","modal"],["pTemplate","header"],[1,"drawer-content"],[1,"ai-loading"],["pTemplate","footer"],[1,"drawer-header"],[1,"pi","pi-sparkles","ai-icon"],[1,"header-text"],[1,"expand-btn",3,"click","title"],[1,"pi"],[1,"ai-pulse"],[1,"insight-section"],[1,"section-label"],[1,"insight-card","glass"],[1,"finding-item",3,"class"],[1,"empty-findings"],[1,"reasoning-box"],[1,"finding-item"],[1,"finding-top"],[3,"value","severity","rounded"],[1,"finding-title"],[1,"finding-detail"],[1,"finding-action"],[1,"action-label"],[1,"action-text"],[1,"pi","pi-check-circle"],[1,"drawer-footer"],["pButton","","label","Apply Automated Fix","icon","pi pi-bolt",1,"p-button-sm","p-button-primary","w-full",3,"disabled"]],template:function(e,n){e&1&&(a(0,"p-drawer",0),pe("visibleChange",function(r){return de(n.visible,r)||(n.visible=r),r}),T("onHide",function(){return n.closed.emit()}),u(1,ut,9,6,"ng-template",1),a(2,"div",2),C(3,ft,4,0,"div",3)(4,gt,17,3),s(),u(5,bt,2,1,"ng-template",4),s()),e&2&&(L(me(6,mt,n.fullscreen?"100vw":"450px")),le("visible",n.visible),d("appendTo","body")("modal",!0),o(3),k(n.loading?3:4))},dependencies:[Ae,Oe,B,Se,Ee,Ve,j],styles:[".drawer-header[_ngcontent-%COMP%]{display:flex;align-items:center;gap:12px;width:100%}.ai-icon[_ngcontent-%COMP%]{font-size:20px;color:var(--accent)}.header-text[_ngcontent-%COMP%]{flex:1}.header-text[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{margin:0;font-size:16px;font-weight:700}.header-text[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin:0;font-size:11px;color:var(--text-muted);font-family:JetBrains Mono,monospace}.expand-btn[_ngcontent-%COMP%]{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}.expand-btn[_ngcontent-%COMP%]:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-subtle)}.drawer-content[_ngcontent-%COMP%]{padding:4px 16px 24px;display:flex;flex-direction:column;gap:24px}.section-label[_ngcontent-%COMP%]{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.insight-card[_ngcontent-%COMP%]{padding:16px;border-radius:12px;font-size:13px;line-height:1.6;color:var(--text-secondary)}.glass[_ngcontent-%COMP%]{background:#ffffff08;border:1px solid var(--border)}.finding-item[_ngcontent-%COMP%]{padding:14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);margin-bottom:10px;border-left:4px solid var(--border)}.severity-critical[_ngcontent-%COMP%]{border-left-color:var(--danger)}.severity-warning[_ngcontent-%COMP%]{border-left-color:var(--warning)}.finding-top[_ngcontent-%COMP%]{display:flex;align-items:center;gap:10px;margin-bottom:8px}.finding-title[_ngcontent-%COMP%]{font-size:13px;font-weight:600}.finding-detail[_ngcontent-%COMP%]{font-size:12px;color:var(--text-secondary);margin-bottom:10px}.finding-action[_ngcontent-%COMP%]{font-size:11px;padding:8px;background:#0003;border-radius:6px}.action-label[_ngcontent-%COMP%]{font-weight:700;color:var(--accent);margin-right:6px}.reasoning-box[_ngcontent-%COMP%]{font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-muted);background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border);white-space:pre-wrap}.ai-loading[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;gap:16px;color:var(--text-muted);font-size:13px}.ai-pulse[_ngcontent-%COMP%]{width:40px;height:40px;background:var(--accent);border-radius:50%;animation:_ngcontent-%COMP%_pulse 1.5s infinite ease-in-out;opacity:.5}@keyframes _ngcontent-%COMP%_pulse{0%{transform:scale(.8);opacity:.5}50%{transform:scale(1.2);opacity:.2}to{transform:scale(.8);opacity:.5}}.empty-findings[_ngcontent-%COMP%]{text-align:center;padding:20px;color:var(--text-muted)}.empty-findings[_ngcontent-%COMP%]   i[_ngcontent-%COMP%]{font-size:24px;color:var(--success);margin-bottom:8px}.drawer-footer[_ngcontent-%COMP%]{padding:16px;border-top:1px solid var(--border)}.w-full[_ngcontent-%COMP%]{width:100%}"]})};export{j as a,Ve as b,$e as c};
