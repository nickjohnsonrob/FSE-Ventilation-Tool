/* @ds-bundle: {"format":3,"namespace":"FlowSystemsDesignSystem_cedef0","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"}],"sourceHashes":{"components/core/Button.jsx":"9476daf4378e","components/core/Card.jsx":"7ad6264d5d49","components/core/Logo.jsx":"03129d2deb4f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FlowSystemsDesignSystem_cedef0 = window.FlowSystemsDesignSystem_cedef0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — Flow Systems' primary action control.
 * Instrument-grade: tight radius, calm transitions, accent reserved
 * for the one primary action. Variants: primary · secondary · ghost · danger.
 */
function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled = false,
  iconLeft,
  iconRight,
  full = false,
  style,
  children,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const h = size === 'sm' ? 28 : size === 'lg' ? 40 : 34;
  const fs = size === 'sm' ? 'var(--text-xs)' : size === 'lg' ? 'var(--text-md)' : 'var(--text-sm)';
  const padX = size === 'sm' ? 'var(--space-3)' : 'var(--space-4)';
  const skins = {
    primary: {
      base: {
        background: 'var(--accent)',
        color: 'var(--text-inverse)',
        border: '1px solid transparent',
        boxShadow: 'var(--shadow-xs)'
      },
      hover: {
        background: 'var(--accent-hover)'
      }
    },
    secondary: {
      base: {
        background: 'var(--surface-sunken)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-default)'
      },
      hover: {
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border-strong)'
      }
    },
    ghost: {
      base: {
        background: 'transparent',
        color: 'var(--text-secondary)',
        border: '1px solid transparent'
      },
      hover: {
        background: 'var(--surface-sunken)',
        color: 'var(--text-primary)'
      }
    },
    danger: {
      base: {
        background: 'transparent',
        color: 'var(--alert-text)',
        border: '1px solid var(--alert-border)'
      },
      hover: {
        background: 'var(--alert-bg)'
      }
    }
  };
  const skin = skins[variant] || skins.secondary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-2)',
      width: full ? '100%' : 'auto',
      height: h,
      padding: `0 ${padX}`,
      fontFamily: 'var(--font-sans)',
      fontSize: fs,
      fontWeight: 'var(--weight-medium)',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transform: active && !disabled ? 'translateY(0.5px)' : 'none',
      transition: 'background var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)',
      ...skin.base,
      ...(hover && !disabled ? skin.hover : null),
      ...style
    }
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flex: 'none'
    }
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flex: 'none'
    }
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — the base surface of the system. A white (or dark) panel
 * with a 1px border and a barely-there shadow. Depth in Flow Systems
 * comes from borders and sunken insets, never float.
 */
function Card({
  variant = 'default',
  padding = 'md',
  style,
  children,
  ...rest
}) {
  const pad = padding === 'none' ? 0 : padding === 'sm' ? 'var(--space-4)' : padding === 'lg' ? 'var(--space-6)' : 'var(--space-5)';
  const skins = {
    default: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-sm)'
    },
    flat: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'none'
    },
    inset: {
      background: 'var(--surface-inset)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-inset)'
    },
    raised: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-md)'
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: 'var(--radius-md)',
      padding: pad,
      ...skins[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Logo — the Flow Systems Engineering lockup: the three-line "flow"
 * mark (decreasing horizontal runs, like duct sizes stepping down)
 * beside the wordmark. Mark color is the slate-purple accent.
 */
function Logo({
  size = 36,
  showWordmark = true,
  tagline = 'Duct Sizing Utility',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    role: "img",
    "aria-label": "Flow Systems Engineering mark",
    style: {
      display: 'block',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("g", {
    stroke: "var(--accent)",
    strokeWidth: "3.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 15 H40"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 24 H32"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 33 H24"
  }))), showWordmark ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.05
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-md)',
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, "Flow Systems", ' ', /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontWeight: 'var(--weight-regular)'
    }
  }, "Engineering")), tagline ? /*#__PURE__*/React.createElement("span", {
    className: "num",
    style: {
      fontSize: 'var(--text-2xs)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--text-accent)'
    }
  }, tagline) : null) : null);
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Logo = __ds_scope.Logo;

})();
