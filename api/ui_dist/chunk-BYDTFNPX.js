import{C as I,Z as L,aa as M,c as k,e as r,l as D,v as a,x as w,y as b,z as l}from"./chunk-KHBYNJJB.js";import{r as v}from"./chunk-YSTFRTJY.js";import{R as p,S as d,Sa as m,W as o,bb as f,cb as h,eb as u,ec as g,oa as c,tc as y}from"./chunk-QS35HLFH.js";var x=`
    .p-ink {
        display: block;
        position: absolute;
        background: dt('ripple.background');
        border-radius: 100%;
        transform: scale(0);
        pointer-events: none;
    }

    .p-ink-active {
        animation: ripple 0.4s linear;
    }

    @keyframes ripple {
        100% {
            opacity: 0;
            transform: scale(2.5);
        }
    }
`;var C=`
    ${x}

    /* For PrimeNG */
    .p-ripple {
        overflow: hidden;
        position: relative;
    }

    .p-ripple-disabled .p-ink {
        display: none !important;
    }

    @keyframes ripple {
        100% {
            opacity: 0;
            transform: scale(2.5);
        }
    }
`,N={root:"p-ink"},E=(()=>{class i extends L{name="ripple";style=C;classes=N;static \u0275fac=(()=>{let e;return function(s){return(e||(e=c(i)))(s||i)}})();static \u0275prov=p({token:i,factory:i.\u0275fac})}return i})();var $=(()=>{class i extends M{zone=o(m);_componentStyle=o(E);animationListener;mouseDownListener;timeout;constructor(){super(),y(()=>{v(this.platformId)&&(this.config.ripple()?this.zone.runOutsideAngular(()=>{this.create(),this.mouseDownListener=this.renderer.listen(this.el.nativeElement,"mousedown",this.onMouseDown.bind(this))}):this.remove())})}onAfterViewInit(){}onMouseDown(e){let t=this.getInk();if(!t||this.document.defaultView?.getComputedStyle(t,null).display==="none")return;if(r(t,"p-ink-active"),!a(t)&&!l(t)){let n=Math.max(D(this.el.nativeElement),b(this.el.nativeElement));t.style.height=n+"px",t.style.width=n+"px"}let s=w(this.el.nativeElement),F=e.pageX-s.left+this.document.body.scrollTop-l(t)/2,A=e.pageY-s.top+this.document.body.scrollLeft-a(t)/2;this.renderer.setStyle(t,"top",A+"px"),this.renderer.setStyle(t,"left",F+"px"),k(t,"p-ink-active"),this.timeout=setTimeout(()=>{let n=this.getInk();n&&r(n,"p-ink-active")},401)}getInk(){let e=this.el.nativeElement.children;for(let t=0;t<e.length;t++)if(typeof e[t].className=="string"&&e[t].className.indexOf("p-ink")!==-1)return e[t];return null}resetInk(){let e=this.getInk();e&&r(e,"p-ink-active")}onAnimationEnd(e){this.timeout&&clearTimeout(this.timeout),r(e.currentTarget,"p-ink-active")}create(){let e=this.renderer.createElement("span");this.renderer.addClass(e,"p-ink"),this.renderer.appendChild(this.el.nativeElement,e),this.renderer.setAttribute(e,"aria-hidden","true"),this.renderer.setAttribute(e,"role","presentation"),this.animationListener||(this.animationListener=this.renderer.listen(e,"animationend",this.onAnimationEnd.bind(this)))}remove(){let e=this.getInk();e&&(this.mouseDownListener&&this.mouseDownListener(),this.animationListener&&this.animationListener(),this.mouseDownListener=null,this.animationListener=null,I(e))}onDestroy(){this.config&&this.config.ripple()&&this.remove()}static \u0275fac=function(t){return new(t||i)};static \u0275dir=h({type:i,selectors:[["","pRipple",""]],hostAttrs:[1,"p-ripple"],features:[g([E]),u]})}return i})(),G=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=f({type:i});static \u0275inj=d({})}return i})();export{$ as a,G as b};
