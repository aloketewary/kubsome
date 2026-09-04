import{b as w}from"./chunk-G227FRKW.js";import{d as F}from"./chunk-DRXOS5RM.js";import{d as D,ia as M,ka as N,la as k,ma as l}from"./chunk-K3UHJ75B.js";import{$a as p,Cb as y,I as f,J as x,L as g,N as d,Rb as I,Xa as m,Ya as u,_a as h,ac as T,ea as v,ha as s,hb as b,ja as r,nc as a,rc as o,zc as c}from"./chunk-IFA4XUDI.js";var S=(()=>{class t extends k{modelValue=v(void 0);$filled=a(()=>D(this.modelValue()));writeModelValue(e){this.modelValue.set(e)}static \u0275fac=(()=>{let e;return function(i){return(e||(e=r(t)))(i||t)}})();static \u0275dir=u({type:t,features:[p]})}return t})();var P=`
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
`;var V=`
    ${P}

    /* For PrimeNG */
   .p-inputtext.ng-invalid.ng-dirty {
        border-color: dt('inputtext.invalid.border.color');
    }

    .p-inputtext.ng-invalid.ng-dirty::placeholder {
        color: dt('inputtext.invalid.placeholder.color');
    }
`,B={root:({instance:t})=>["p-inputtext p-component",{"p-filled":t.$filled(),"p-inputtext-sm":t.pSize==="small","p-inputtext-lg":t.pSize==="large","p-invalid":t.invalid(),"p-variant-filled":t.$variant()==="filled","p-inputtext-fluid":t.hasFluid}]},z=(()=>{class t extends M{name="inputtext";style=V;classes=B;static \u0275fac=(()=>{let e;return function(i){return(e||(e=r(t)))(i||t)}})();static \u0275prov=f({token:t,factory:t.\u0275fac})}return t})();var C=new g("INPUTTEXT_INSTANCE"),it=(()=>{class t extends S{componentName="InputText";hostName="";ptInputText=o();pInputTextPT=o();pInputTextUnstyled=o();bindDirectiveInstance=d(l,{self:!0});$pcInputText=d(C,{optional:!0,skipSelf:!0})??void 0;ngControl=d(F,{optional:!0,self:!0});pcFluid=d(w,{optional:!0,host:!0,skipSelf:!0});pSize;variant=o();fluid=o(void 0,{transform:c});invalid=o(void 0,{transform:c});$variant=a(()=>this.variant()||this.config.inputStyle()||this.config.inputVariant());_componentStyle=d(z);constructor(){super(),s(()=>{let e=this.ptInputText()||this.pInputTextPT();e&&this.directivePT.set(e)}),s(()=>{this.pInputTextUnstyled()&&this.directiveUnstyled.set(this.pInputTextUnstyled())})}onAfterViewInit(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value),this.cd.detectChanges()}onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptm("root"))}onDoCheck(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value)}onInput(){this.writeModelValue(this.ngControl?.value??this.el.nativeElement.value)}get hasFluid(){return this.fluid()??!!this.pcFluid}get dataP(){return this.cn({invalid:this.invalid(),fluid:this.hasFluid,filled:this.$variant()==="filled",[this.pSize]:this.pSize})}static \u0275fac=function(n){return new(n||t)};static \u0275dir=u({type:t,selectors:[["","pInputText",""]],hostVars:3,hostBindings:function(n,i){n&1&&y("input",function(){return i.onInput()}),n&2&&(b("data-p",i.dataP),I(i.cx("root")))},inputs:{hostName:"hostName",ptInputText:[1,"ptInputText"],pInputTextPT:[1,"pInputTextPT"],pInputTextUnstyled:[1,"pInputTextUnstyled"],pSize:"pSize",variant:[1,"variant"],fluid:[1,"fluid"],invalid:[1,"invalid"]},features:[T([z,{provide:C,useExisting:t},{provide:N,useExisting:t}]),h([l]),p]})}return t})(),ot=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=m({type:t});static \u0275inj=x({})}return t})();export{S as a,it as b,ot as c};
