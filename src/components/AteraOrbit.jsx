import React from "react";
import { useAppContext } from "../app/AppContext";

export default function AteraOrbit({ className = "" }) {
  const { copy } = useAppContext();

  return (
    <div className={`who-orbit ${className}`.trim()} aria-hidden="true">
      <div className="who-core">Atera</div>
      <span className="who-node node-plan">{copy("Plan", "Planla")}</span>
      <span className="who-node node-test">{copy("Test", "Dene")}</span>
      <span className="who-node node-decide">{copy("Decide", "Karar ver")}</span>
      <span className="who-node node-scale">{copy("Scale", "Büyüt")}</span>
    </div>
  );
}
