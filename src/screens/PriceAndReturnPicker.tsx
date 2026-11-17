import { MAX_PRICE_AMOUNT, PRICE_LEVELS, priceLevelFor } from "../../shared/prices.js";

interface PriceAndReturnPickerProps {
  price: number | null;
  /** The exact price in whole dollars, when they typed one instead of picking a level. */
  priceAmount: number | null;
  onPrice: (price: number | null, priceAmount: number | null) => void;
  wouldReturn: boolean | null;
  onWouldReturn: (wouldReturn: boolean | null) => void;
}

const GO_AGAIN = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
] as const;

/** The two optional questions after the score. Tapping the chosen answer again clears it. */
export function PriceAndReturnPicker({ price, priceAmount, onPrice, wouldReturn, onWouldReturn }: PriceAndReturnPickerProps) {
  // A typed price lights up the level it falls in; picking a level by hand drops the typed price.
  function typeAmount(typed: string) {
    const digits = typed.replace(/\D/g, "");
    const amount = digits === "" ? null : Math.min(Number(digits), MAX_PRICE_AMOUNT);
    if (amount === null || amount === 0) onPrice(null, null);
    else onPrice(priceLevelFor(amount), amount);
  }

  return (
    <>
      <fieldset>
        <legend>Price per person <span className="optional">optional</span></legend>
        <div className="choices four">
          {PRICE_LEVELS.map((option) => (
            <button
              key={option.level}
              type="button"
              className={option.level === price ? "score-option choice selected" : "score-option choice"}
              aria-pressed={option.level === price}
              onClick={() => onPrice(option.level === price ? null : option.level, null)}
            >
              {option.label}
              <small>{option.range}</small>
            </button>
          ))}
        </div>
        <label className="price-amount">
          <span>Or type what you paid</span>
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input
              inputMode="numeric"
              value={priceAmount ?? ""}
              onChange={(event) => typeAmount(event.target.value)}
              placeholder="e.g. 23"
              autoComplete="off"
            />
          </span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Would you go again? <span className="optional">optional</span></legend>
        <div className="choices two">
          {GO_AGAIN.map((option) => (
            <button
              key={option.label}
              type="button"
              className={option.value === wouldReturn ? "score-option selected" : "score-option"}
              aria-pressed={option.value === wouldReturn}
              onClick={() => onWouldReturn(option.value === wouldReturn ? null : option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
