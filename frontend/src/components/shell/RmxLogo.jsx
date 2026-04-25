export default function RmxLogo({ className = "", height = 28 }) {
  return (
    <svg
      viewBox="0 0 180 56"
      height={height}
      className={className}
      aria-label="RMX"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="48"
        fontSize="56"
        fontWeight="900"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        letterSpacing="-2"
      >
        RMX
      </text>
    </svg>
  );
}
