import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

export default function PlotChart({ data, layout, config }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    Plotly.newPlot(
      ref.current,
      data,
      { autosize: true, ...layout },
      { responsive: true, displaylogo: false, ...config }
    );
    return () => {
      if (ref.current) Plotly.purge(ref.current);
    };
  }, [data, layout, config]);

  return <div ref={ref} style={{ width: "100%" }} />;
}