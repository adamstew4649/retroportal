import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Fish, Utensils } from 'lucide-react';
import { useWidgetSettings } from '../../state/PortalContext';
import type { FishSettings } from '../../types';
import { createAquarium, type AquariumController, type AquariumSettings } from './aquarium';
import { MAX_FISH, MIN_FISH, resolveFishColours } from './palette';
import '../widgets.css';
import './fish.css';

const SPEED_LABELS: Record<FishSettings['speed'], string> = {
  calm: 'Calm',
  normal: 'Normal',
  lively: 'Lively',
};

function toAquariumSettings(settings: FishSettings): AquariumSettings {
  const fishCount = Math.min(MAX_FISH, Math.max(MIN_FISH, Math.round(settings.fishCount) || 1));
  return {
    fishCount,
    colours: resolveFishColours(settings.colours, fishCount),
    speed: settings.speed,
    water: settings.water,
    bubbles: settings.bubbles,
    plants: settings.plants,
  };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function FishWidget() {
  const [settings] = useWidgetSettings('fish');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<AquariumController | null>(null);
  const settingsRef = useRef(settings);
  const [feedCount, setFeedCount] = useState(0);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const reducedMotion = useReducedMotion();

  settingsRef.current = settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = createAquarium(canvas, toAquariumSettings(settingsRef.current));
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.update(toAquariumSettings(settingsRef.current));
  }, [settings]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (reducedMotion) {
      controller.stop();
      controller.renderStatic();
      return;
    }
    if (inView && !pageHidden) controller.start();
    else controller.stop();
  }, [inView, pageHidden, reducedMotion]);

  useEffect(() => {
    const updateVisibility = () => setPageHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    controllerRef.current?.setPointer(point.x, point.y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = pointFromEvent(event);
    controllerRef.current?.dropFood(point.x, point.y);
    setFeedCount((count) => count + 1);
  };

  const feedFromSurface = () => {
    controllerRef.current?.dropFoodFromSurface();
    setFeedCount((count) => count + 1);
  };

  const fishCount = toAquariumSettings(settings).fishCount;

  return (
    <div className={`fish-widget${settings.tall ? ' fish-widget--tall' : ''}`}>
      <div className="fish-toolbar">
        <span className="status-pill">
          <Fish size={11} aria-hidden="true" />
          {fishCount} fish
          <span className="fish-toolbar__speed">· {SPEED_LABELS[settings.speed]}</span>
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={feedFromSurface}
          aria-label="Drop food into the fish tank"
          title="Drop food"
        >
          <Utensils size={13} aria-hidden="true" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="fish-canvas"
        role="img"
        aria-label={`A fish tank with ${fishCount} fish. Move the pointer over the tank to attract them, or click to drop food.`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => controllerRef.current?.clearPointer()}
        onPointerDown={handlePointerDown}
      />

      {reducedMotion ? (
        <p className="info-note fish-widget__note">
          Animation paused because reduced motion is enabled. You can still drop food with the
          button.
        </p>
      ) : (
        <p className="info-note fish-widget__note">
          Move over the tank to attract the fish, then click the water to feed them.
        </p>
      )}

      <span className="visually-hidden" role="status" aria-live="polite">
        {feedCount > 0
          ? `Food dropped ${feedCount} ${feedCount === 1 ? 'time' : 'times'}.`
          : ''}
      </span>
    </div>
  );
}

export function FishSettings() {
  const [settings, update] = useWidgetSettings('fish');
  const colours = resolveFishColours(settings.colours, settings.fishCount);

  const changeCount = (value: number) => {
    const fishCount = Math.min(MAX_FISH, Math.max(MIN_FISH, Math.round(value) || 1));
    update({
      fishCount,
      colours: resolveFishColours(settings.colours, fishCount),
    });
  };

  const changeColour = (index: number, colour: string) => {
    const next = [...colours];
    next[index] = colour;
    update({ colours: next });
  };

  return (
    <div className="form-stack">
      <label>
        <span className="field-label">Fish: {settings.fishCount}</span>
        <input
          className="retro-range"
          type="range"
          min={MIN_FISH}
          max={MAX_FISH}
          step={1}
          value={settings.fishCount}
          onChange={(event) => changeCount(Number(event.target.value))}
        />
      </label>

      <div className="form-grid">
        <label>
          <span className="field-label">Current</span>
          <select
            className="retro-select"
            value={settings.speed}
            onChange={(event) =>
              update({ speed: event.target.value as FishSettings['speed'] })
            }
          >
            <option value="calm">Calm</option>
            <option value="normal">Normal</option>
            <option value="lively">Lively</option>
          </select>
        </label>
        <label>
          <span className="field-label">Water</span>
          <select
            className="retro-select"
            value={settings.water}
            onChange={(event) =>
              update({ water: event.target.value as FishSettings['water'] })
            }
          >
            <option value="reef">Coral reef</option>
            <option value="lagoon">Lagoon</option>
            <option value="freshwater">Freshwater</option>
            <option value="night">Midnight</option>
          </select>
        </label>
      </div>

      <fieldset className="fish-colour-fieldset">
        <legend className="field-label">Fish colours</legend>
        <div className="fish-colour-grid">
          {colours.map((colour, index) => (
            <label className="fish-colour" key={index}>
              <input
                type="color"
                value={colour}
                onChange={(event) => changeColour(index, event.target.value)}
                aria-label={`Fish ${index + 1} colour`}
              />
              <span>Fish {index + 1}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.bubbles}
          onChange={(event) => update({ bubbles: event.target.checked })}
        />
        Bubbles
      </label>
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.plants}
          onChange={(event) => update({ plants: event.target.checked })}
        />
        Plants and gravel
      </label>
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.tall}
          onChange={(event) => update({ tall: event.target.checked })}
        />
        Taller tank
      </label>

      <p className="info-note">
        Move the pointer over the tank to attract the fish. Click the water, or use the food button,
        to feed them. Colour changes apply to that fish immediately.
      </p>
    </div>
  );
}
