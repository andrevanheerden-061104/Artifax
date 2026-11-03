import React, { useEffect, useLayoutEffect, useState } from 'react';
import './DeviceFrame.css';

/**
 * Shows the whole app inside a landscape tablet (11" iPad-sized screen) on large
 * displays, to make it clear Artifax is a tablet product. On real tablets and phones
 * (narrow windows) the app simply fills the screen.
 *
 * The tablet's screen is a fixed 1194 × 834 "logical" size and the whole device is
 * scaled to fit the browser window, so the layout looks exactly like it would on the
 * real device.
 */

const SCREEN_WIDTH = 1194;
const SCREEN_HEIGHT = 834;
const BEZEL = 22;
const OUTER_MARGIN = 28;
/** Below this window width we assume a real tablet/phone and drop the frame. */
const FRAME_MIN_WINDOW_WIDTH = 900;
const PREFERENCE_KEY = 'artifax.deviceFrame';

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function computeScale(): number {
  const deviceWidth = SCREEN_WIDTH + BEZEL * 2;
  const deviceHeight = SCREEN_HEIGHT + BEZEL * 2;
  const availableWidth = window.innerWidth - OUTER_MARGIN * 2;
  const availableHeight = window.innerHeight - OUTER_MARGIN * 2 - 36; // room for the caption
  return Math.max(0.3, Math.min(availableWidth / deviceWidth, availableHeight / deviceHeight, 1.25));
}

function DeviceFrame({ children }: { children: React.ReactNode }) {
  const [frameOn, setFrameOn] = useState<boolean>(() => readPreference());
  const [wideEnough, setWideEnough] = useState<boolean>(() => window.innerWidth >= FRAME_MIN_WINDOW_WIDTH);
  const [scale, setScale] = useState<number>(() => computeScale());

  useLayoutEffect(() => {
    const onResize = () => {
      setWideEnough(window.innerWidth >= FRAME_MIN_WINDOW_WIDTH);
      setScale(computeScale());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showFrame = frameOn && wideEnough;

  useEffect(() => {
    document.documentElement.classList.toggle('has-device-frame', showFrame);
  }, [showFrame]);

  const toggle = () => {
    const next = !frameOn;
    setFrameOn(next);
    try {
      window.localStorage.setItem(PREFERENCE_KEY, next ? 'on' : 'off');
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
  };

  if (!showFrame) {
    return (
      <>
        {children}
        {wideEnough ? (
          <button type="button" className="device-toggle device-toggle--floating" onClick={toggle}>
            Show tablet view
          </button>
        ) : null}
      </>
    );
  }

  const deviceWidth = SCREEN_WIDTH + BEZEL * 2;
  const deviceHeight = SCREEN_HEIGHT + BEZEL * 2;

  return (
    <div className="device-stage">
      <div className="device-scaler" style={{ width: deviceWidth * scale, height: deviceHeight * scale }}>
        <div
          className="device-body"
          style={{
            width: deviceWidth,
            height: deviceHeight,
            padding: BEZEL,
            transform: `scale(${scale})`,
          }}
        >
          <span className="device-camera" aria-hidden="true" />
          {/* The screen: transform makes it the containing block for position:fixed (modals, toasts) */}
          <div className="device-screen" style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
            <div className="device-scroll" id="device-scroll">
              {children}
            </div>
          </div>
        </div>
      </div>

      <div className="device-caption">
        <span>Artifax · tablet preview</span>
        <button type="button" className="device-toggle" onClick={toggle}>
          Full screen
        </button>
      </div>
    </div>
  );
}

export default DeviceFrame;
