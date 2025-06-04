import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        backgroundColor: "#4f46e5",
        color: "white",
        padding: "8px 16px",
        border: "none",
        borderRadius: 4,
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}
