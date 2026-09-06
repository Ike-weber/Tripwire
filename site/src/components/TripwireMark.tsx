/**
 * The Tripwire mark: a wire strung taut between two posts, with the trigger
 * node at its centre — the thing that trips.
 *
 * Drawn from the product's own idea rather than adapted from any existing
 * logo. Geometry only: two verticals, one horizontal, one node. Uses
 * `currentColor` so it takes the colour of whatever it sits in, and stays
 * legible down to favicon size because nothing in it is smaller than the
 * stroke width.
 */
export default function TripwireMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* posts */}
      <path d="M3 5.5V18.5" />
      <path d="M21 5.5V18.5" />
      {/* the wire */}
      <path d="M3 12H21" />
      {/* trigger node */}
      <circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
