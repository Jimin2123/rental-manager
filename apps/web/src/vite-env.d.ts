/// <reference types="vite/client" />

interface Window {
  daum: {
    Postcode: new (options: { oncomplete: (data: import('./lib/kakao-address').KakaoAddressResult) => void }) => {
      open: () => void;
    };
  };
}
