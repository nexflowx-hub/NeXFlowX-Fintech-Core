// NeXFlowX - SumUp SDK Loader Wrapper
(function() {
    console.log("🚀 NeXFlowX SumUp SDK Loader Active");
    const script = document.createElement('script');
    script.src = 'https://gateway.sumup.com/gateway/ecom/card/v1.2/js/sdk.js';
    script.onload = function() {
        console.log("✅ SumUp SDK loaded successfully");
    };
    document.head.appendChild(script);
})();
