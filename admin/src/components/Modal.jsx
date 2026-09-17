export default function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h1 style={{ margin: 0 }}>{title}</h1>
          <button className="btn secondary" onClick={onClose}>✕</button>
        </div>
        <div className="mt">{children}</div>
        {footer ? <div className="row mt">{footer}</div> : null}
      </div>
    </div>
  );
}
