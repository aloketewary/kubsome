import{a as Le,b as ze}from"./chunk-WCXEW57Y.js";import{a as Oe}from"./chunk-CNX54RNG.js";import{c as ve,d as Q,f as R,h as j,i as Z,j as q}from"./chunk-L6DDJOKO.js";import{a as Ie,b as Ee}from"./chunk-BEWQPPO5.js";import{c as O}from"./chunk-PIVHVL5F.js";import{F as Ce,Ha as Pe,Ia as Ae,Ja as Be,X as $,f as ge,h as we,j as be,m as xe,na as z,oa as V,ra as ke,ta as Te,ua as Se,v as H,va as D,w as ye,ya as Me,za as De}from"./chunk-TYKA7HTF.js";import{$ as g,$b as pe,Bb as re,Cb as oe,Db as I,Dc as x,Eb as E,Ec as _e,Gb as k,Ib as p,Jb as ae,Kb as se,Lb as v,Ma as a,Mb as N,Nb as h,Ob as _,R as W,Ra as y,S as J,Tb as le,U as K,Ub as B,Vb as M,W as P,Wb as c,Xb as b,Yb as de,aa as w,ab as A,ac as ce,ba as X,bb as Y,bc as me,dc as fe,eb as U,fb as ee,fc as L,gb as m,gc as ue,nb as C,oa as F,ob as T,pb as S,qb as te,qc as he,sb as ne,tb as ie,ub as d,vb as r,wb as s,xb as u}from"./chunk-L5GWP4RM.js";var Ve=`
    .p-drawer {
        display: flex;
        flex-direction: column;
        transform: translate3d(0px, 0px, 0px);
        position: relative;
        transition: transform 0.3s;
        background: dt('drawer.background');
        color: dt('drawer.color');
        border: 1px solid dt('drawer.border.color');
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

    .p-drawer-left .p-drawer-enter-from,
    .p-drawer-left .p-drawer-leave-to {
        transform: translateX(-100%);
    }

    .p-drawer-right .p-drawer-enter-from,
    .p-drawer-right .p-drawer-leave-to {
        transform: translateX(100%);
    }

    .p-drawer-top .p-drawer-enter-from,
    .p-drawer-top .p-drawer-leave-to {
        transform: translateY(-100%);
    }

    .p-drawer-bottom .p-drawer-enter-from,
    .p-drawer-bottom .p-drawer-leave-to {
        transform: translateY(100%);
    }

    .p-drawer-full .p-drawer-enter-from,
    .p-drawer-full .p-drawer-leave-to {
        opacity: 0;
    }

    .p-drawer-full .p-drawer-enter-active,
    .p-drawer-full .p-drawer-leave-active {
        transition: opacity 400ms cubic-bezier(0.25, 0.8, 0.25, 1);
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
`;var qe=["header"],He=["footer"],$e=["content"],Ge=["closeicon"],We=["headless"],Je=["container"],Ke=["closeButton"],Xe=["*"],Ye=(t,l)=>({transform:t,transition:l}),Ue=t=>({value:"visible",params:t});function et(t,l){t&1&&I(0)}function tt(t,l){if(t&1&&m(0,et,1,0,"ng-container",4),t&2){let e=p(2);d("ngTemplateOutlet",e.headlessTemplate||e._headlessTemplate)}}function nt(t,l){t&1&&I(0)}function it(t,l){if(t&1&&(r(0,"div",9),c(1),s()),t&2){let e=p(3);M(e.cx("title")),d("pBind",e.ptm("title")),a(),b(e.header)}}function rt(t,l){t&1&&(X(),u(0,"svg",12)),t&2&&C("data-pc-section","closeicon")}function ot(t,l){}function at(t,l){t&1&&m(0,ot,0,0,"ng-template")}function st(t,l){if(t&1&&m(0,rt,1,1,"svg",11)(1,at,1,0,null,4),t&2){let e=p(4);d("ngIf",!e.closeIconTemplate&&!e._closeIconTemplate),a(),d("ngTemplateOutlet",e.closeIconTemplate||e._closeIconTemplate)}}function lt(t,l){if(t&1){let e=E();r(0,"p-button",10),k("onClick",function(i){g(e);let o=p(3);return w(o.close(i))})("keydown.enter",function(i){g(e);let o=p(3);return w(o.close(i))}),m(1,st,2,2,"ng-template",null,1,he),s()}if(t&2){let e=p(3);d("pt",e.ptm("pcCloseButton"))("ngClass",e.cx("pcCloseButton"))("buttonProps",e.closeButtonProps)("ariaLabel",e.ariaCloseLabel),C("data-pc-group-section","iconcontainer")}}function dt(t,l){t&1&&I(0)}function pt(t,l){t&1&&I(0)}function ct(t,l){if(t&1&&(re(0),r(1,"div",5),m(2,pt,1,0,"ng-container",4),s(),oe()),t&2){let e=p(3);a(),d("pBind",e.ptm("footer"))("ngClass",e.cx("footer")),C("data-pc-section","footer"),a(),d("ngTemplateOutlet",e.footerTemplate||e._footerTemplate)}}function mt(t,l){if(t&1&&(r(0,"div",5),m(1,nt,1,0,"ng-container",4)(2,it,2,4,"div",6)(3,lt,3,5,"p-button",7),s(),r(4,"div",5),se(5),m(6,dt,1,0,"ng-container",4),s(),m(7,ct,3,4,"ng-container",8)),t&2){let e=p(2);d("pBind",e.ptm("header"))("ngClass",e.cx("header")),C("data-pc-section","header"),a(),d("ngTemplateOutlet",e.headerTemplate||e._headerTemplate),a(),d("ngIf",e.header),a(),d("ngIf",e.showCloseIcon&&e.closable),a(),d("pBind",e.ptm("content"))("ngClass",e.cx("content")),C("data-pc-section","content"),a(2),d("ngTemplateOutlet",e.contentTemplate||e._contentTemplate),a(),d("ngIf",e.footerTemplate||e._footerTemplate)}}function ft(t,l){if(t&1){let e=E();r(0,"div",3,0),k("@panelState.start",function(i){g(e);let o=p();return w(o.onAnimationStart(i))})("@panelState.done",function(i){g(e);let o=p();return w(o.onAnimationEnd(i))})("keydown",function(i){g(e);let o=p();return w(o.onKeyDown(i))}),T(2,tt,1,1,"ng-container")(3,mt,8,11),s()}if(t&2){let e=p();B(e.style),M(e.cn(e.cx("root"),e.styleClass)),d("pBind",e.ptm("root"))("@panelState",L(10,Ue,ue(7,Ye,e.transformOptions,e.transitionOptions))),a(2),S(e.headlessTemplate||e._headlessTemplate?2:3)}}var ut=`
    ${Ve}

    /** For PrimeNG **/
    .p-drawer {
        position: fixed;
        display: flex;
        flex-direction: column;
    }

    .p-drawer-left {
        top: 0;
        left: 0;
        width: 20rem;
        height: 100%;
    }

    .p-drawer-right {
        top: 0;
        right: 0;
        width: 20rem;
        height: 100%;
    }

    .p-drawer-top {
        top: 0;
        left: 0;
        width: 100%;
        height: 10rem;
    }

    .p-drawer-bottom {
        bottom: 0;
        left: 0;
        width: 100%;
        height: 10rem;
    }

    .p-drawer-full {
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        -webkit-transition: none;
        transition: none;
    }

    .p-overlay-mask-enter {
        animation: p-overlay-mask-enter-animation 150ms forwards;
    }

    .p-overlay-mask-leave {
        animation: p-overlay-mask-leave-animation 150ms forwards;
    }

    @keyframes p-overlay-mask-enter-animation {
        from {
            background-color: transparent;
        }
        to {
            background-color: rgba(0, 0, 0, 0.4);
        }
    }
    @keyframes p-overlay-mask-leave-animation {
        from {
            background-color: rgba(0, 0, 0, 0.4);
        }
        to {
            background-color: transparent;
        }
    }
`,ht={mask:({instance:t})=>["p-drawer-mask",{"p-overlay-mask p-overlay-mask-enter":t.modal},{"p-drawer-full":t.fullScreen}],root:({instance:t})=>["p-drawer p-component",{"p-drawer-full":t.fullScreen,"p-drawer-open":t.visible},`p-drawer-${t.position}`],header:"p-drawer-header",title:"p-drawer-title",pcCloseButton:"p-drawer-close-button",content:"p-drawer-content",footer:"p-drawer-footer"},Fe=(()=>{class t extends ke{name="drawer";style=ut;classes=ht;static \u0275fac=(()=>{let e;return function(i){return(e||(e=F(t)))(i||t)}})();static \u0275prov=W({token:t,factory:t.\u0275fac})}return t})();var Ne=new K("DRAWER_INSTANCE"),_t=Z([R({transform:"{{transform}}",opacity:0}),Q("{{transition}}")]),gt=Z([Q("{{transition}}",R({transform:"{{transform}}",opacity:0}))]),Qe="translate3d(-100%, 0px, 0px)",G=(()=>{class t extends Se{$pcDrawer=P(Ne,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=P(D,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptm("host"))}appendTo="body";blockScroll=!1;style;styleClass;ariaCloseLabel;autoZIndex=!0;baseZIndex=0;modal=!0;closeButtonProps={severity:"secondary",text:!0,rounded:!0};dismissible=!0;showCloseIcon=!0;closeOnEscape=!0;transitionOptions="150ms cubic-bezier(0, 0, 0.2, 1)";get visible(){return this._visible??!1}set visible(e){this._visible=e}get position(){return this._position}set position(e){if(this._position=e,e==="full"){this.transformOptions="none";return}switch(e){case"left":this.transformOptions="translate3d(-100%, 0px, 0px)";break;case"right":this.transformOptions="translate3d(100%, 0px, 0px)";break;case"bottom":this.transformOptions="translate3d(0px, 100%, 0px)";break;case"top":this.transformOptions="translate3d(0px, -100%, 0px)";break}}get fullScreen(){return this._fullScreen}set fullScreen(e){this._fullScreen=e,e===!0?this.transformOptions="none":this.transformOptions=Qe}header;maskStyle;closable=!0;onShow=new y;onHide=new y;visibleChange=new y;containerViewChild;closeButtonViewChild;initialized;_visible;_position="left";_fullScreen=!1;container;transformOptions=Qe;mask;maskClickListener;documentEscapeListener;animationEndListener;_componentStyle=P(Fe);onAfterViewInit(){this.initialized=!0}headerTemplate;footerTemplate;contentTemplate;closeIconTemplate;headlessTemplate;_headerTemplate;_footerTemplate;_contentTemplate;_closeIconTemplate;_headlessTemplate;templates;onAfterContentInit(){this.templates?.forEach(e=>{switch(e.getType()){case"content":this._contentTemplate=e.template;break;case"header":this._headerTemplate=e.template;break;case"footer":this._footerTemplate=e.template;break;case"closeicon":this._closeIconTemplate=e.template;break;case"headless":this._headlessTemplate=e.template;break;default:this._contentTemplate=e.template;break}})}onKeyDown(e){e.code==="Escape"&&this.hide(!1)}show(){this.container?.setAttribute(this.$attrSelector,""),this.autoZIndex&&O.set("modal",this.container,this.baseZIndex||this.config.zIndex.modal),this.modal&&this.enableModality(),this.onShow.emit({}),this.visibleChange.emit(!0)}hide(e=!0){e&&this.onHide.emit({}),this.modal&&this.disableModality()}close(e){this.hide(),this.visibleChange.emit(!1),e.preventDefault()}enableModality(){let e=this.document.querySelectorAll(".p-drawer-open"),n=e.length,i=n==1?String(parseInt(this.container.style.zIndex)-1):String(parseInt(e[n-1].style.zIndex)-1);this.mask||(this.mask=this.renderer.createElement("div"),this.mask&&($(this.mask,"style",this.getMaskStyle()),$(this.mask,"style",`z-index: ${i}`),H(this.mask,this.cx("mask"))),this.dismissible&&(this.maskClickListener=this.renderer.listen(this.mask,"click",o=>{this.dismissible&&this.close(o)})),this.renderer.appendChild(this.document.body,this.mask),this.blockScroll&&Me())}getMaskStyle(){return this.maskStyle?Object.entries(this.maskStyle).map(([e,n])=>`${e}: ${n}`).join("; "):""}disableModality(){this.mask&&(ye(this.mask,"p-overlay-mask-enter"),H(this.mask,"p-overlay-mask-leave"),this.animationEndListener=this.renderer.listen(this.mask,"animationend",this.destroyModal.bind(this)))}destroyModal(){this.unbindMaskClickListener(),this.mask&&this.renderer.removeChild(this.document.body,this.mask),this.blockScroll&&De(),this.unbindAnimationEndListener(),this.mask=null}onAnimationStart(e){e.toState==="visible"&&(this.container=e.element,this.appendContainer(),this.show(),this.closeOnEscape&&this.bindDocumentEscapeListener())}onAnimationEnd(e){e.toState==="void"&&(this.hide(!1),O.clear(this.container),this.unbindGlobalListeners())}appendContainer(){this.appendTo&&(this.appendTo==="body"&&this.container?this.renderer.appendChild(this.document.body,this.container):this.container&&Ce(this.appendTo,this.container))}bindDocumentEscapeListener(){let e=this.el?this.el.nativeElement.ownerDocument:this.document;this.documentEscapeListener=this.renderer.listen(e,"keydown",n=>{n.which==27&&parseInt(this.container.style.zIndex)===O.get(this.container)&&this.close(n)})}unbindDocumentEscapeListener(){this.documentEscapeListener&&(this.documentEscapeListener(),this.documentEscapeListener=null)}unbindMaskClickListener(){this.maskClickListener&&(this.maskClickListener(),this.maskClickListener=null)}unbindGlobalListeners(){this.unbindMaskClickListener(),this.unbindDocumentEscapeListener()}unbindAnimationEndListener(){this.animationEndListener&&this.mask&&(this.animationEndListener(),this.animationEndListener=null)}onDestroy(){this.initialized=!1,this.visible&&this.modal&&this.destroyModal(),this.appendTo&&this.container&&this.renderer.appendChild(this.el.nativeElement,this.container),this.container&&this.autoZIndex&&O.clear(this.container),this.container=null,this.unbindGlobalListeners(),this.unbindAnimationEndListener()}static \u0275fac=(()=>{let e;return function(i){return(e||(e=F(t)))(i||t)}})();static \u0275cmp=A({type:t,selectors:[["p-drawer"]],contentQueries:function(n,i,o){if(n&1&&(v(o,qe,4),v(o,He,4),v(o,$e,4),v(o,Ge,4),v(o,We,4),v(o,z,4)),n&2){let f;h(f=_())&&(i.headerTemplate=f.first),h(f=_())&&(i.footerTemplate=f.first),h(f=_())&&(i.contentTemplate=f.first),h(f=_())&&(i.closeIconTemplate=f.first),h(f=_())&&(i.headlessTemplate=f.first),h(f=_())&&(i.templates=f)}},viewQuery:function(n,i){if(n&1&&(N(Je,5),N(Ke,5)),n&2){let o;h(o=_())&&(i.containerViewChild=o.first),h(o=_())&&(i.closeButtonViewChild=o.first)}},inputs:{appendTo:"appendTo",blockScroll:[2,"blockScroll","blockScroll",x],style:"style",styleClass:"styleClass",ariaCloseLabel:"ariaCloseLabel",autoZIndex:[2,"autoZIndex","autoZIndex",x],baseZIndex:[2,"baseZIndex","baseZIndex",_e],modal:[2,"modal","modal",x],closeButtonProps:"closeButtonProps",dismissible:[2,"dismissible","dismissible",x],showCloseIcon:[2,"showCloseIcon","showCloseIcon",x],closeOnEscape:[2,"closeOnEscape","closeOnEscape",x],transitionOptions:"transitionOptions",visible:"visible",position:"position",fullScreen:"fullScreen",header:"header",maskStyle:"maskStyle",closable:[2,"closable","closable",x]},outputs:{onShow:"onShow",onHide:"onHide",visibleChange:"visibleChange"},features:[fe([Fe,{provide:Ne,useExisting:t},{provide:Te,useExisting:t}]),ee([D]),U],ngContentSelectors:Xe,decls:1,vars:1,consts:[["container",""],["icon",""],["role","complementary","pFocusTrap","",3,"pBind","class","style","keydown",4,"ngIf"],["role","complementary","pFocusTrap","",3,"keydown","pBind"],[4,"ngTemplateOutlet"],[3,"pBind","ngClass"],[3,"pBind","class",4,"ngIf"],[3,"pt","ngClass","buttonProps","ariaLabel","onClick","keydown.enter",4,"ngIf"],[4,"ngIf"],[3,"pBind"],[3,"onClick","keydown.enter","pt","ngClass","buttonProps","ariaLabel"],["data-p-icon","times",4,"ngIf"],["data-p-icon","times"]],template:function(n,i){n&1&&(ae(),m(0,ft,4,12,"div",2)),n&2&&d("ngIf",i.visible)},dependencies:[xe,ge,we,be,Ae,Oe,V,D,ze,Le],encapsulation:2,data:{animation:[ve("panelState",[j("void => visible",[q(_t)]),j("visible => void",[q(gt)])])]},changeDetection:0})}return t})(),Re=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=Y({type:t});static \u0275inj=J({imports:[G,V,V]})}return t})();var bt=t=>({width:t});function xt(t,l){if(t&1){let e=E();r(0,"div",5),u(1,"i",6),r(2,"div",7)(3,"h3"),c(4,"AI Diagnosis"),s(),r(5,"p"),c(6),s()(),r(7,"button",8),k("click",function(){g(e);let i=p();return w(i.fullscreen=!i.fullscreen)}),u(8,"i",9),s()()}if(t&2){let e=p();a(6),b(e.resourceName),a(),d("title",e.fullscreen?"Collapse":"Expand"),a(),le("pi-window-minimize",e.fullscreen)("pi-expand",!e.fullscreen)}}function vt(t,l){t&1&&(r(0,"div",3),u(1,"div",10),r(2,"p"),c(3,"Analyzing resource events and logs..."),s()())}function yt(t,l){if(t&1&&(r(0,"div",17)(1,"div",18),u(2,"p-tag",19),r(3,"span",20),c(4),s()(),r(5,"p",21),c(6),s(),r(7,"div",22)(8,"span",23),c(9,"Recommendation:"),s(),r(10,"span",24),c(11),s()()()),t&2){let e=l.$implicit;M("severity-"+e.severity),a(2),d("value",e.severity)("severity",e.severity==="critical"?"danger":"warn")("rounded",!0),a(2),b(e.title),a(2),b(e.detail),a(5),b(e.action)}}function Ct(t,l){t&1&&(r(0,"div",15),u(1,"i",25),r(2,"p"),c(3,"No critical issues detected by AI."),s()())}function kt(t,l){if(t&1&&(r(0,"div",11)(1,"div",12),c(2,"Summary"),s(),r(3,"div",13)(4,"p"),c(5),s()()(),r(6,"div",11)(7,"div",12),c(8,"Findings"),s(),ne(9,yt,12,8,"div",14,te),T(11,Ct,4,0,"div",15),s(),r(12,"div",11)(13,"div",12),c(14,"AI Reasoning"),s(),r(15,"div",16),c(16),s()()),t&2){let e=p();a(5),b(e.summary),a(4),ie(e.findings),a(2),S(e.findings.length===0?11:-1),a(5),de(" ",e.reasoning," ")}}function Tt(t,l){if(t&1&&(r(0,"div",26),u(1,"button",27),s()),t&2){let e=p();a(),d("disabled",e.findings.length===0)}}var je=class t{visible=!1;loading=!1;resourceName="";summary="";findings=[];reasoning="";closed=new y;fullscreen=!1;static \u0275fac=function(e){return new(e||t)};static \u0275cmp=A({type:t,selectors:[["app-ai-insight-drawer"]],inputs:{visible:"visible",loading:"loading",resourceName:"resourceName",summary:"summary",findings:"findings",reasoning:"reasoning"},outputs:{closed:"closed"},decls:6,vars:8,consts:[["position","right",3,"visibleChange","onHide","visible","appendTo","modal"],["pTemplate","header"],[1,"drawer-content"],[1,"ai-loading"],["pTemplate","footer"],[1,"drawer-header"],[1,"pi","pi-sparkles","ai-icon"],[1,"header-text"],[1,"expand-btn",3,"click","title"],[1,"pi"],[1,"ai-pulse"],[1,"insight-section"],[1,"section-label"],[1,"insight-card","glass"],[1,"finding-item",3,"class"],[1,"empty-findings"],[1,"reasoning-box"],[1,"finding-item"],[1,"finding-top"],[3,"value","severity","rounded"],[1,"finding-title"],[1,"finding-detail"],[1,"finding-action"],[1,"action-label"],[1,"action-text"],[1,"pi","pi-check-circle"],[1,"drawer-footer"],["pButton","","label","Apply Automated Fix","icon","pi pi-bolt",1,"p-button-sm","p-button-primary","w-full",3,"disabled"]],template:function(e,n){e&1&&(r(0,"p-drawer",0),me("visibleChange",function(o){return ce(n.visible,o)||(n.visible=o),o}),k("onHide",function(){return n.closed.emit()}),m(1,xt,9,6,"ng-template",1),r(2,"div",2),T(3,vt,4,0,"div",3)(4,kt,17,3),s(),m(5,Tt,2,1,"ng-template",4),s()),e&2&&(B(L(6,bt,n.fullscreen?"100vw":"450px")),pe("visible",n.visible),d("appendTo","body")("modal",!0),a(3),S(n.loading?3:4))},dependencies:[Ee,Ie,z,Be,Pe,Re,G],styles:[".drawer-header[_ngcontent-%COMP%]{display:flex;align-items:center;gap:12px;width:100%}.ai-icon[_ngcontent-%COMP%]{font-size:20px;color:var(--accent)}.header-text[_ngcontent-%COMP%]{flex:1}.header-text[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{margin:0;font-size:16px;font-weight:700}.header-text[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin:0;font-size:11px;color:var(--text-muted);font-family:JetBrains Mono,monospace}.expand-btn[_ngcontent-%COMP%]{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}.expand-btn[_ngcontent-%COMP%]:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-subtle)}.drawer-content[_ngcontent-%COMP%]{padding:4px 16px 24px;display:flex;flex-direction:column;gap:24px}.section-label[_ngcontent-%COMP%]{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.insight-card[_ngcontent-%COMP%]{padding:16px;border-radius:12px;font-size:13px;line-height:1.6;color:var(--text-secondary)}.glass[_ngcontent-%COMP%]{background:#ffffff08;border:1px solid var(--border)}.finding-item[_ngcontent-%COMP%]{padding:14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);margin-bottom:10px;border-left:4px solid var(--border)}.severity-critical[_ngcontent-%COMP%]{border-left-color:var(--danger)}.severity-warning[_ngcontent-%COMP%]{border-left-color:var(--warning)}.finding-top[_ngcontent-%COMP%]{display:flex;align-items:center;gap:10px;margin-bottom:8px}.finding-title[_ngcontent-%COMP%]{font-size:13px;font-weight:600}.finding-detail[_ngcontent-%COMP%]{font-size:12px;color:var(--text-secondary);margin-bottom:10px}.finding-action[_ngcontent-%COMP%]{font-size:11px;padding:8px;background:#0003;border-radius:6px}.action-label[_ngcontent-%COMP%]{font-weight:700;color:var(--accent);margin-right:6px}.reasoning-box[_ngcontent-%COMP%]{font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-muted);background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border);white-space:pre-wrap}.ai-loading[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;gap:16px;color:var(--text-muted);font-size:13px}.ai-pulse[_ngcontent-%COMP%]{width:40px;height:40px;background:var(--accent);border-radius:50%;animation:_ngcontent-%COMP%_pulse 1.5s infinite ease-in-out;opacity:.5}@keyframes _ngcontent-%COMP%_pulse{0%{transform:scale(.8);opacity:.5}50%{transform:scale(1.2);opacity:.2}to{transform:scale(.8);opacity:.5}}.empty-findings[_ngcontent-%COMP%]{text-align:center;padding:20px;color:var(--text-muted)}.empty-findings[_ngcontent-%COMP%]   i[_ngcontent-%COMP%]{font-size:24px;color:var(--success);margin-bottom:8px}.drawer-footer[_ngcontent-%COMP%]{padding:16px;border-top:1px solid var(--border)}.w-full[_ngcontent-%COMP%]{width:100%}"]})};export{G as a,Re as b,je as c};
