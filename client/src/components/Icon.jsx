const PATHS = {
  inbox: 'M4 6h16v12H4z M4 10h16',
  chart: 'M4 19V10 M10 19V5 M16 19v-7 M20 19H4',
  revenue: 'M4 16l5-5 3 3 7-8 M14 6h6v6',
  chat: 'M5 6h14v9H8l-3 3z',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16 10a2.5 2.5 0 1 0 0-5 M4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4 M15 15c1.8.2 3.3 1.3 4 3',
  card: 'M3 7h18v10H3z M3 11h18',
  alert: 'M12 4l8 14H4z M12 10v4 M12 16.5v.5',
  ticket: 'M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z',
  shield: 'M12 3l7 3v6c0 4.2-2.8 7.2-7 9-4.2-1.8-7-4.8-7-9V6z',
  heart: 'M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z',
  image: 'M4 6h16v12H4z M8 14l2.5-2.5L14 15l2-2 2 2',
  spark: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z',
  plug: 'M8 8V4 M16 8V4 M7 8h10v4a5 5 0 0 1-10 0z M12 17v3',
  bot: 'M8 9h8v7H8z M12 9V6 M9 13h.1 M15 13h.1 M9 19v-3 M15 19v-3',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M12 3.5v2 M12 18.5v2 M4.8 6.8l1.5 1.5 M17.7 15.7l1.5 1.5 M3.5 12h2 M18.5 12h2 M4.8 17.2l1.5-1.5 M17.7 8.3l1.5-1.5',
  billing: 'M6 4h12v16l-2-1.2L14 20l-2-1.2L10 20l-2-1.2L6 20z M9 9h6 M9 13h6',
  book: 'M5 5h10a4 4 0 0 1 4 4v11H8a3 3 0 0 0-3 3z M5 5v15',
  logout: 'M10 7V5H5v14h5v-2 M10 12h9 M16 9l3 3-3 3',
  phone: 'M8 4h3l1 4-2 1a12 12 0 0 0 5 5l1-2 4 1v3a2 2 0 0 1-2 2A14 14 0 0 1 6 6a2 2 0 0 1 2-2z',
  refresh: 'M20 12a8 8 0 1 1-2.2-5.5 M20 5v5h-5',
  link: 'M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2 M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2',
  unlink: 'M9 15l6-6 M8 8l-2 2a4 4 0 0 0 5.7 5.7L13 14 M16 16l2-2a4 4 0 0 0-5.7-5.7L11 10',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  check: 'M5 12l5 5L20 7',
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.spark} />
    </svg>
  );
}
