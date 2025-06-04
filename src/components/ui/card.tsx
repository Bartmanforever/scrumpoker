import React from "react";

type CardProps = {
  children: React.ReactNode;
};

export function Card({ children }: CardProps) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function CardContent({ children }: CardProps) {
  return <div>{children}</div>;
}
