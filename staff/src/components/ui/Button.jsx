export function Button({ variant = 'primary', type = 'button', children, className = '', ...props }) {
  const variantClass = variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
  return (
    <button type={type} className={`btn ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
