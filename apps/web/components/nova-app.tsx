import type { Snapshot } from "../lib/analytics";
import { Icon } from "./icon";

function ProductVisual() {
  return <svg className="product-visual" viewBox="0 0 320 265" role="img" aria-label="Original illustration of a moss green ceramic mug on a cream pedestal">
    <defs>
      <linearGradient id="ceramic" x1="0" x2="1"><stop stopColor="#608275" /><stop offset=".35" stopColor="#78988a" /><stop offset=".8" stopColor="#5e7e70" /><stop offset="1" stopColor="#496c5c" /></linearGradient>
      <linearGradient id="plinth" x1="0" x2="0" y2="1"><stop stopColor="#dedbd0" /><stop offset="1" stopColor="#e9e6db" /></linearGradient>
      <pattern id="speckle" width="21" height="19" patternUnits="userSpaceOnUse"><circle cx="4" cy="6" r=".7" fill="#2e5044" opacity=".28" /><circle cx="16" cy="15" r=".5" fill="#d5e0d2" opacity=".45" /></pattern>
    </defs>
    <path d="M0 214 320 195v70H0Z" fill="#e1dfd5" />
    <path d="m45 215 116-27 122 29-116 33Z" fill="#f3f0e5" />
    <path d="m45 215 122 35v15H45Z" fill="url(#plinth)" /><path d="m167 250 116-33v48H167Z" fill="#d6d3c7" />
    <ellipse cx="172" cy="208" rx="83" ry="14" fill="#b6b7a7" opacity=".36" />
    <path d="M207 112c54-14 64 63 16 68l-15-2v-17l11 2c25-2 23-38-8-32Z" fill="#4e7060" />
    <path d="M209 110c53-10 62 60 16 64" fill="none" stroke="#7f9b8c" strokeWidth="6" />
    <path d="m97 101 8 88c3 33 102 33 107 0l8-88Z" fill="url(#ceramic)" />
    <path d="m97 101 8 88c3 33 102 33 107 0l8-88Z" fill="url(#speckle)" />
    <ellipse cx="158.5" cy="101" rx="61.5" ry="22" fill="#93a99a" /><ellipse cx="158.5" cy="101" rx="54.5" ry="16" fill="#375849" />
    <path d="M110 103c17-15 80-16 98 0-20 15-78 14-98 0Z" fill="#496a57" />
    <path d="m109 123 5 57" stroke="#bacaba" strokeWidth="3" opacity=".3" strokeLinecap="round" />
  </svg>;
}


export function NovaApp({ state, onAdd }: { state: Snapshot; onAdd: () => void }) {
  return <section className="shopping-panel" aria-label="Nova shopping app">
    <div className="shop-caption"><span>NOVA SHOPPING APP</span><span className="simulation-label">Browser simulation</span></div>
<div className="phone"><div className="phone-status" aria-hidden="true"><span>9:41</span><span className="island" /><span className="phone-indicators">▮▮▮ <span className="battery" /></span></div>
          <div className="nova-nav"><span className="nova-logo">nova<span>®</span></span><span className="cart-indicator" role="status" aria-live="polite" aria-label={`Cart: ${state?.cart ?? 0} items`}><Icon name="bag" /><span>{state?.cart ?? 0}</span></span></div>
          <div className="product-art"><span className="collection-tag">THE EVERYDAY COLLECTION</span><ProductVisual /><span className="image-pagination" aria-hidden="true"><i /><i /><i /></span></div>
          <div className="product-info"><div className="product-title"><h3>The Everyday Mug</h3><span>$28</span></div><p>A little calm in your daily ritual.</p><div className="product-options"><span className="color-swatch" />Moss<span className="product-material">Glazed stoneware · 12 oz</span></div><button className="add-to-cart" disabled={!state} onClick={() => { onAdd(); }}>Add to cart<Icon name="bag" /></button><p className={`cart-feedback ${state?.cart ? "has-items" : ""}`} aria-live="polite">{state?.cart ? <><Icon name="check" />{state.cart} {state.cart === 1 ? "item" : "items"} in your cart · ${(state.cart * 28).toFixed(2)}</> : "Thoughtfully made for everyday moments."}</p></div>
          <div className="home-indicator" aria-hidden="true" />
        </div>
  </section>;
}
