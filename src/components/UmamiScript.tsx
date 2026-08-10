export default function UmamiScript() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_ID;
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";

  if (!websiteId) return null;

  return (
    <script
      defer
      src={src}
      data-website-id={websiteId}
      data-domains="xn----ctbheruicd8a.xn--p1ai"
    />
  );
}
