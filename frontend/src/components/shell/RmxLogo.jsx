export default function RmxLogo({ className = "" }) {
  return (
    <span
      className={`inline-block leading-none select-none ${className}`}
      style={{
        fontFamily: '"Arial Black", "Helvetica Neue", Impact, sans-serif',
        fontWeight: 900,
        letterSpacing: "-0.04em",
      }}
    >
      RMX
    </span>
  );
}
