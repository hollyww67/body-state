"use client";

import { useEffect, useState } from "react";

export default function Snowdrifts() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(document.documentElement.getAttribute("data-theme") === "newyear");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 4 }}>
      <div className="absolute bottom-0 right-0 w-1/3 h-32 backdrop-blur-sm">
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-blue-50/90 via-white/50 to-transparent rounded-tl-[120px] rounded-tr-[80px]" />
        <div className="absolute bottom-0 left-10 right-0 h-16 bg-gradient-to-t from-blue-50/80 via-white/30 to-transparent rounded-tl-[100px] rounded-tr-[60px]" />
      </div>

      <div className="absolute bottom-0 left-0 w-2/5 h-28 backdrop-blur-sm">
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-blue-50/90 via-white/50 to-transparent rounded-tr-[100px] rounded-tl-[60px]" />
        <div className="absolute bottom-0 left-0 right-10 h-14 bg-gradient-to-t from-blue-50/80 via-white/30 to-transparent rounded-tr-[80px] rounded-tl-[40px]" />
      </div>

      <div className="absolute bottom-0 left-1/3 w-1/4 h-20 backdrop-blur-sm">
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-blue-50/85 via-white/40 to-transparent rounded-t-[70px]" />
      </div>

      <div className="absolute bottom-0 right-1/4 w-1/6 h-16 backdrop-blur-sm">
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-blue-50/80 via-white/30 to-transparent rounded-t-[50px]" />
      </div>
    </div>
  );
}
