import{a as M}from"./chunk-SGNYRRCS.js";import{d as k}from"./chunk-XF4ZSIS3.js";import{g as N}from"./chunk-UHBL75FZ.js";import{Da as I,Fa as T,Ha as d}from"./chunk-HLLXYX3X.js";import{Ac as o,Hc as u,Ib as v,R as a,S as p,U as l,W as e,Xb as b,bb as c,cb as f,eb as x,fb as g,fc as h,oa as s,xc as m,yc as y}from"./chunk-QWHQ5QRO.js";var D=`
    .p-inputtext {
        font-family: inherit;
        font-feature-settings: inherit;
        font-size: 1rem;
        color: dt('inputtext.color');
        background: dt('inputtext.background');
        padding-block: dt('inputtext.padding.y');
        padding-inline: dt('inputtext.padding.x');
        border: 1px solid dt('inputtext.border.color');
        transition:
            background dt('inputtext.transition.duration'),
            color dt('inputtext.transition.duration'),
            border-color dt('inputtext.transition.duration'),
            outline-color dt('inputtext.transition.duration'),
            box-shadow dt('inputtext.transition.duration');
        appearance: none;
        border-radius: dt('inputtext.border.radius');
        outline-color: transparent;
        box-shadow: dt('inputtext.shadow');
    }

    .p-inputtext:enabled:hover {
        border-color: dt('inputtext.hover.border.color');
    }

    .p-inputtext:enabled:focus {
        border-color: dt('inputtext.focus.border.color');
        box-shadow: dt('inputtext.focus.ring.shadow');
        outline: dt('inputtext.focus.ring.width') dt('inputtext.focus.ring.style') dt('inputtext.focus.ring.color');
        outline-offset: dt('inputtext.focus.ring.offset');
    }

    .p-inputtext.p-invalid {
        border-color: dt('inputtext.invalid.border.color');
    }

    .p-inputtext.p-variant-filled {
        background: dt('inputtext.filled.background');
    }

    .p-inputtext.p-variant-filled:enabled:hover {
        background: dt('inputtext.filled.hover.background');
    }

    .p-inputtext.p-variant-filled:enabled:focus {
        background: dt('inputtext.filled.focus.background');
    }

    .p-inputtext:disabled {
        opacity: 1;
        background: dt('inputtext.disabled.background');
        color: dt('inputtext.disabled.color');
    }

    .p-inputtext::placeholder {
        color: dt('inputtext.placeholder.color');
    }

    .p-inputtext.p-invalid::placeholder {
        color: dt('inputtext.invalid.placeholder.color');
    }

    .p-inputtext-sm {
        font-size: dt('inputtext.sm.font.size');
        padding-block: dt('inputtext.sm.padding.y');
        padding-inline: dt('inputtext.sm.padding.x');
    }

    .p-inputtext-lg {
        font-size: dt('inputtext.lg.font.size');
        padding-block: dt('inputtext.lg.padding.y');
        padding-inline: dt('inputtext.lg.padding.x');
    }

    .p-inputtext-fluid {
        width: 100%;
    }
`;var C=`
    ${D}

    /* For PrimeNG */
   .p-inputtext.ng-invalid.ng-dirty {
        border-color: dt('inputtext.invalid.border.color');
    }

    .p-inputtext.ng-invalid.ng-dirty::placeholder {
        color: dt('inputtext.invalid.placeholder.color');
    }
`,E={root:({instance:t})=>["p-inputtext p-component",{"p-filled":t.$filled(),"p-inputtext-sm":t.pSize==="small","p-inputtext-lg":t.pSize==="large","p-invalid":t.invalid(),"p-variant-filled":t.$variant()==="filled","p-inputtext-fluid":t.hasFluid}]},w=(()=>{class t extends I{name="inputtext";style=C;classes=E;static \u0275fac=(()=>{let i;return function(r){return(i||(i=s(t)))(r||t)}})();static \u0275prov=a({token:t,factory:t.\u0275fac})}return t})();var F=new l("INPUTTEXT_INSTANCE"),O=(()=>{class t extends M{hostName="";ptInputText=o();bindDirectiveInstance=e(d,{self:!0});$pcInputText=e(F,{optional:!0,skipSelf:!0})??void 0;ngControl=e(k,{optional:!0,self:!0});pcFluid=e(N,{optional:!0,host:!0,skipSelf:!0});pSize;variant=o();fluid=o(void 0,{transform:u});invalid=o(void 0,{transform:u});$variant=m(()=>this.variant()||this.config.inputStyle()||this.config.inputVariant());_componentStyle=e(w);constructor(){super(),y(()=>{this.ptInputText()&&this.directivePT.set(this.ptInputText())})}onAfterViewInit(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value),this.cd.detectChanges()}onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptm("root"))}onDoCheck(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value)}onInput(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value)}get hasFluid(){return this.fluid()??!!this.pcFluid}static \u0275fac=function(n){return new(n||t)};static \u0275dir=f({type:t,selectors:[["","pInputText",""]],hostVars:2,hostBindings:function(n,r){n&1&&v("input",function(S){return r.onInput(S)}),n&2&&b(r.cx("root"))},inputs:{hostName:"hostName",ptInputText:[1,"ptInputText"],pSize:"pSize",variant:[1,"variant"],fluid:[1,"fluid"],invalid:[1,"invalid"]},features:[h([w,{provide:F,useExisting:t},{provide:T,useExisting:t}]),g([d]),x]})}return t})(),Q=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=c({type:t});static \u0275inj=p({})}return t})();export{O as a,Q as b};
