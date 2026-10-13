/** cPanel / Passenger startup file: Passenger loads CommonJS, the app itself is ESM. */
import('./index.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
