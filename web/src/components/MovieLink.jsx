export const filmUrl = (movie) => new URL(`${import.meta.env.BASE_URL}film/${movie.id}/`, location.origin).href;

export function MovieLink({ movie, onOpen, day, children, ...props }) {
  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen(movie.id, day);
  }

  return (
    <a {...props} href={filmUrl(movie)} onClick={handleClick}>
      {children}
    </a>
  );
}
