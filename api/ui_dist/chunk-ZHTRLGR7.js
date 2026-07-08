import{a as V}from"./chunk-S5EB7QU7.js";import{P as T,_ as m,a as N,aa as P,ba as c,ca as h}from"./chunk-52OXKRHZ.js";import{s as S,u as j}from"./chunk-S33XIWYP.js";import{Bb as g,Cb as C,Db as v,Ib as k,Ic as A,Ob as d,Pa as B,Pb as u,T as f,W as F,Y as i,_b as p,da as I,db as a,fb as b,ga as D,hb as s,ib as w,jc as l,qa as r,qb as x,sa as M,wa as E}from"./chunk-DRTRB7S5.js";var te=(()=>{class e extends c{autofocus=!1;focused=!1;platformId=i(E);document=i(D);host=i(M);onAfterContentChecked(){this.autofocus===!1?this.host.nativeElement.removeAttribute("autofocus"):this.host.nativeElement.setAttribute("autofocus",!0),this.focused||this.autoFocus()}onAfterViewChecked(){this.focused||this.autoFocus()}autoFocus(){j(this.platformId)&&this.autofocus&&setTimeout(()=>{let t=V.getFocusableElements(this.host?.nativeElement);t.length===0&&this.host.nativeElement.focus(),t.length>0&&t[0].focus(),this.focused=!0})}static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275dir=b({type:e,selectors:[["","pAutoFocus",""]],inputs:{autofocus:[0,"pAutoFocus","autofocus"]},features:[s]})}return e})();var G=["*"],Z={root:"p-fluid"},H=(()=>{class e extends m{name="fluid";classes=Z;static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275prov=f({token:e,factory:e.\u0275fac})}return e})();var L=new F("FLUID_INSTANCE"),me=(()=>{class e extends c{$pcFluid=i(L,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=i(h,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}_componentStyle=i(H);static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275cmp=a({type:e,selectors:[["p-fluid"]],hostVars:2,hostBindings:function(n,o){n&2&&p(o.cx("root"))},features:[l([H,{provide:L,useExisting:e},{provide:P,useExisting:e}]),w([h]),s],ngContentSelectors:G,decls:1,vars:0,template:function(n,o){n&1&&(d(),u(0))},dependencies:[S],encapsulation:2,changeDetection:0})}return e})();var $=["*"],q=`
.p-icon {
    display: inline-block;
    vertical-align: baseline;
    flex-shrink: 0;
}

.p-icon-spin {
    -webkit-animation: p-icon-spin 2s infinite linear;
    animation: p-icon-spin 2s infinite linear;
}

@-webkit-keyframes p-icon-spin {
    0% {
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
    }
    100% {
        -webkit-transform: rotate(359deg);
        transform: rotate(359deg);
    }
}

@keyframes p-icon-spin {
    0% {
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
    }
    100% {
        -webkit-transform: rotate(359deg);
        transform: rotate(359deg);
    }
}
`,R=(()=>{class e extends m{name="baseicon";css=q;static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275prov=f({token:e,factory:e.\u0275fac,providedIn:"root"})}return e})();var U=(()=>{class e extends c{spin=!1;_componentStyle=i(R);getClassNames(){return N("p-icon",{"p-icon-spin":this.spin})}static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275cmp=a({type:e,selectors:[["ng-component"]],hostAttrs:["width","14","height","14","viewBox","0 0 14 14","fill","none","xmlns","http://www.w3.org/2000/svg"],hostVars:2,hostBindings:function(n,o){n&2&&p(o.getClassNames())},inputs:{spin:[2,"spin","spin",A]},features:[l([R]),s],ngContentSelectors:$,decls:1,vars:0,template:function(n,o){n&1&&(d(),u(0))},encapsulation:2,changeDetection:0})}return e})();var z=["data-p-icon","spinner"],ke=(()=>{class e extends U{pathId;onInit(){this.pathId="url(#"+T()+")"}static \u0275fac=(()=>{let t;return function(o){return(t||(t=r(e)))(o||e)}})();static \u0275cmp=a({type:e,selectors:[["","data-p-icon","spinner"]],features:[s],attrs:z,decls:5,vars:2,consts:[["d","M6.99701 14C5.85441 13.999 4.72939 13.7186 3.72012 13.1832C2.71084 12.6478 1.84795 11.8737 1.20673 10.9284C0.565504 9.98305 0.165424 8.89526 0.041387 7.75989C-0.0826496 6.62453 0.073125 5.47607 0.495122 4.4147C0.917119 3.35333 1.59252 2.4113 2.46241 1.67077C3.33229 0.930247 4.37024 0.413729 5.4857 0.166275C6.60117 -0.0811796 7.76026 -0.0520535 8.86188 0.251112C9.9635 0.554278 10.9742 1.12227 11.8057 1.90555C11.915 2.01493 11.9764 2.16319 11.9764 2.31778C11.9764 2.47236 11.915 2.62062 11.8057 2.73C11.7521 2.78503 11.688 2.82877 11.6171 2.85864C11.5463 2.8885 11.4702 2.90389 11.3933 2.90389C11.3165 2.90389 11.2404 2.8885 11.1695 2.85864C11.0987 2.82877 11.0346 2.78503 10.9809 2.73C9.9998 1.81273 8.73246 1.26138 7.39226 1.16876C6.05206 1.07615 4.72086 1.44794 3.62279 2.22152C2.52471 2.99511 1.72683 4.12325 1.36345 5.41602C1.00008 6.70879 1.09342 8.08723 1.62775 9.31926C2.16209 10.5513 3.10478 11.5617 4.29713 12.1803C5.48947 12.7989 6.85865 12.988 8.17414 12.7157C9.48963 12.4435 10.6711 11.7264 11.5196 10.6854C12.3681 9.64432 12.8319 8.34282 12.8328 7C12.8328 6.84529 12.8943 6.69692 13.0038 6.58752C13.1132 6.47812 13.2616 6.41667 13.4164 6.41667C13.5712 6.41667 13.7196 6.47812 13.8291 6.58752C13.9385 6.69692 14 6.84529 14 7C14 8.85651 13.2622 10.637 11.9489 11.9497C10.6356 13.2625 8.85432 14 6.99701 14Z","fill","currentColor"],[3,"id"],["width","14","height","14","fill","white"]],template:function(n,o){n&1&&(I(),g(0,"g"),v(1,"path",0),C(),g(2,"defs")(3,"clipPath",1),v(4,"rect",2),C()()),n&2&&(x("clip-path",o.pathId),B(3),k("id",o.pathId))},encapsulation:2})}return e})();export{te as a,me as b,U as c,ke as d};
