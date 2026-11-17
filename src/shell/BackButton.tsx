import { useNavigate } from "react-router";
import { Icon } from "./Icon.js";

/**
 * Goes back where you came from, or to the feed when the page was opened from a link.
 * The round look is a white circle that sits on top of a photo.
 */
export function BackButton({ look = "text" }: { look?: "text" | "round" }) {
  const navigate = useNavigate();
  function goBack() {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate("/");
  }
  if (look === "round") {
    return (
      <button type="button" className="hero-button" aria-label="Back" onClick={goBack}>
        <Icon name="back" size={20} />
      </button>
    );
  }
  return (
    <button type="button" className="text-action back-link" onClick={goBack}>
      <Icon name="back" size={16} />
      Back
    </button>
  );
}
