import React from "react";

/**
 * Stops one broken section from blanking the whole site. Without this, a bad
 * admin override (a project with no image, malformed imported JSON) throws
 * during render and React unmounts the entire tree, leaving a white page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("[Super Graphic] render error:", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container-x py-24 text-center">
        <h1 className="font-display font-bold text-3xl text-ink">{this.props.title}</h1>
        <p className="mt-3 text-ink/60 max-w-md mx-auto">{this.props.body}</p>
        <button type="button" className="btn-ink mt-7" onClick={() => window.location.reload()}>
          {this.props.reload}
        </button>
      </div>
    );
  }
}
