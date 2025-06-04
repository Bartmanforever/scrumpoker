import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  return (
    <input
      {...props}
      style={{
        padding: 8,
        borderRadius: 4,
        border: "1px solid #ccc",
        marginBottom: 12,
        width: "100%"
      }}
    />
  );
}
