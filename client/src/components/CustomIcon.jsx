import React from "react";

/**
 * CustomIcon: Versatile icon renderer that supports:
 * 1. Lucide / React Component: <CustomIcon icon={Flame} size={16} color="#ef4444" />
 * 2. Pre-rendered React Element: <CustomIcon icon={<Flame size={16} />} />
 * 3. SVG URL / Asset path string: <CustomIcon icon="/icons/fire.svg" size={16} />
 * 4. Raw SVG string: <CustomIcon icon="<svg>...</svg>" size={16} />
 */
export default function CustomIcon({ icon, name, size = 16, color = "currentColor", style = {}, className = "" }) {
  const targetIcon = icon;

  if (!targetIcon) return null;

  // 1. If it's a string (SVG path, URL, or raw SVG code)
  if (typeof targetIcon === "string") {
    const trimmed = targetIcon.trim();

    // Raw inline SVG code
    if (trimmed.startsWith("<svg") && trimmed.endsWith("</svg>")) {
      return (
        <span
          className={`custom-svg-icon ${className}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
            color: color,
            flexShrink: 0,
            ...style,
          }}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      );
    }

    // Image URL / asset path (e.g., .svg file, /assets/icons/assistant.svg, data:image/svg+xml)
    if (color && color !== "currentColor") {
      return (
        <span
          role="img"
          aria-label={name || "icon"}
          className={`custom-svg-icon ${className}`}
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
            backgroundColor: color,
            WebkitMaskImage: `url("${targetIcon}")`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
            maskImage: `url("${targetIcon}")`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
            flexShrink: 0,
            ...style,
          }}
        />
      );
    }

    return (
      <img
        src={targetIcon}
        alt={name || "icon"}
        className={`custom-svg-img ${className}`}
        style={{
          width: typeof size === "number" ? `${size}px` : size,
          height: typeof size === "number" ? `${size}px` : size,
          objectFit: "contain",
          flexShrink: 0,
          display: "inline-block",
          verticalAlign: "middle",
          ...style,
        }}
      />
    );
  }

  // 2. If it's a pre-instantiated React element (e.g. <Flame size={16} />)
  if (React.isValidElement(targetIcon)) {
    return React.cloneElement(targetIcon, {
      size: targetIcon.props.size || size,
      color: targetIcon.props.color || color,
      style: { ...targetIcon.props.style, ...style },
      className: `${targetIcon.props.className || ""} ${className}`.trim(),
    });
  }

  // 3. If it's a Component function / class (e.g. Flame, Shield, custom SvgComponent)
  if (typeof targetIcon === "function" || typeof targetIcon === "object") {
    const Component = targetIcon;
    return <Component size={size} color={color} style={style} className={className} />;
  }

  return null;
}
