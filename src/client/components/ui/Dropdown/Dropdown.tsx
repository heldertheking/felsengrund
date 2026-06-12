import {type ReactNode, useRef, useState} from "react";
import {Link} from "react-router-dom";

export interface DropdownProps {
    children: ReactNode;
    title: string;
    openOn: "click" | "hover";
    position: "left" | "right" | "top" | "bottom";
    titleHref?: string;
}

export function Dropdown({children, title, openOn, position, titleHref}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false); // FIXME: Change to false
    const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    const toggle = () => setIsOpen((prev) => !prev);

    const handleMouseEnter = () => {
        if (openOn !== "hover") return;
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        open();
    };

    const handleMouseLeave = () => {
        if (openOn !== "hover") return;
        hoverTimeout.current = setTimeout(close, 120);
    };

    const handleTitleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        toggle();
    };

    const positionStyles: Record<string, React.CSSProperties> = {
        bottom: {top: "100%", left: 0, marginTop: 4},
        top: {bottom: "100%", left: 0, marginBottom: 4},
        left: {right: "100%", top: 0, marginRight: 4},
        right: {left: "100%", top: 0, marginLeft: 4},
    };

    return (
        <div
            style={{position: "relative", display: "inline-block"}}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {titleHref ? (
                <Link
                    to={titleHref}
                    onClick={openOn === "click" ? handleTitleClick : undefined}
                    style={{cursor: "pointer", userSelect: "none"}}
                >
                    {title}
                </Link>
            ) : (
                <span
                    onClick={openOn === "click" ? toggle : undefined}
                    style={{cursor: openOn === "click" ? "pointer" : "default", userSelect: "none"}}
                >
            {title}
        </span>
            )}

            <div style={{
                position: "absolute",
                zIndex: 1000,
                transform: "translateX(-25%)",
                width: "fit-content",
                opacity: isOpen ? 1 : 0,
                visibility: isOpen ? "visible" : "hidden",
                transition: "opacity 150ms ease, visibility 150ms ease",
                ...positionStyles[position]
            }}>
                {children}
            </div>
        </div>
    );
}