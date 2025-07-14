import { useState, useRef, type RefObject } from 'react'
import { asSvg, svgDoc, group, circle, line, Group } from "@thi.ng/geom"
import { Vec2, vec2, add2 } from "@thi.ng/vectors"
import * as parser from "./parser.cjs"
import './App.css'

const letterSharpness = {
  'a': 6, //7
  'b': 6,
  'c': 4,
  'd': 6,
  'e': 6,
  'f': 12,
  'g': 6,
  'h': 7,
  'i': 4,
  'j': 4,
  'k': 11,
  'l': 4,
  'm': 9,
  'n': 7,
  'o': 0,
  'p': 6,
  'q': 6,
  'r': 7,
  's': 4,
  't': 12,
  'u': 7,
  'v': 7,
  'w': 12,
  'x': 12,
  'y': 7,
  'z': 10,
}
const maxSharpness = Object.values(letterSharpness).sort((a, b) => a - b).at(-1)!;
const letterSharpnessNorm: Record<string, number> = Object.entries(letterSharpness).map(x => [x[0], x[1] / maxSharpness]).reduce((o, kv) => ({ ...o, [kv[0]]: kv[1] }), {})

function App() {
  const inpRef: RefObject<HTMLInputElement | null> = useRef(null);
  const svgContRef: RefObject<HTMLDivElement | null> = useRef(null);
  const [parseRes, setparseRes] = useState({ "data": {}, "string": "" });

  function parseInput() {
    const pres: Record<string, string | Array<unknown> | unknown> = parser.parse(inpRef.current?.value);
    console.log(pres);
    setparseRes({ "data": pres, "string": JSON.stringify(pres, null, 2) });
  }

  function calcTextSharpness(text: string): number {
    return text.trim().split("").map((c: string) => letterSharpnessNorm[c] as number).reduce((a: number, b: number) => a + b) / text.length;
  }

  function distributeOnRadius(radius: number, numpts: number, offsetDeg: number = 0, varianceDeg: number = 0, variancemult: number = 0): Vec2[] {
    const partitionSize = (360 / numpts) / 360 * 2 * Math.PI;
    const offset = offsetDeg / 360 * 2 * Math.PI;
    return [...Array(numpts).keys()].map((_, i) => {
      const variance = Math.random() * 2 - 1 * (varianceDeg / 360 * 2 * Math.PI);
      const v = vec2(Math.cos(offset + i * partitionSize + variance * variancemult) * radius, Math.sin(offset + i * partitionSize + variance * variancemult) * radius);

      return v;
    });

  }

  function generateGeomRecurse(object: Record<string, string | unknown>, geomGroup: Group, circlemult: number = 3, scalemult: number = 1, weightmult: number = 1, centerpoint: Vec2) {
    if (["func", "args"].every(x => Object.keys(object).includes(x))) {
      // if object is function application
      let sharpness = 0;
      if (object["func"].constructor == String) {
        sharpness = calcTextSharpness(object["func"] as string);
      } else {
        generateGeomRecurse(object["func"] as Record<string, string | unknown>, geomGroup, circlemult, scalemult * 0.4, weightmult, centerpoint);
        sharpness = calcTextSharpness((object["func"] as Record<string, string | unknown>)["var"] as string);
      }
      let meanrad = 0;
      console.log(`${JSON.stringify(object["func"])} -> ${sharpness} -> ${Math.round(sharpness * circlemult)} circles`);
      [...Array(Math.round(sharpness * circlemult)).keys()].forEach(x => {
        const rad = (45 - x * 1.5) * scalemult;
        const weight = 0.5 / x;
        geomGroup.add(circle(centerpoint, rad, { stroke: "aquamarine", fill: "#232323", weight: weight * weightmult }));
        meanrad += rad;
      });
      meanrad /= Math.round(sharpness * circlemult);
      console.log(`Mean Radius: ${meanrad}`);

      const pts = distributeOnRadius(meanrad, (object["args"] as Array<unknown>).length, 0, 5, 1);
      pts.forEach((p, i) => {
        geomGroup.add(line(add2([], pts.at(i - 1) as Vec2, centerpoint), add2([], p, centerpoint), { stroke: "aquamarine", weight: 0.5 * weightmult }));
        geomGroup.add(line(centerpoint, add2([], p, centerpoint), { stroke: "aquamarine", weight: 0.5 * weightmult }));
      });
      pts.forEach((p, i) => {
        const v = (object["args"] as Array<unknown>)[i];
        if (v.constructor == String) {
          sharpness = calcTextSharpness(v as string);
          geomGroup.add(circle(add2([], p, centerpoint), 1 + (sharpness * 29) * scalemult, { stroke: "aquamarine", fill: "#232323", weight: 0.5 * weightmult }));
        } else {
          generateGeomRecurse(v as Record<string, string | unknown>, geomGroup, circlemult * 0.6, scalemult * 0.4, weightmult, add2([], p, centerpoint) as Vec2);
        }
      });
    } else if (["var", "scope"].every(x => Object.keys(object).includes(x))) {
      // if object is namespace
      let sharpness = calcTextSharpness(object["var"] as string);
      console.log(`${object["var"]} -> ${sharpness} -> ${Math.round(sharpness * circlemult)} circles`);
      [...Array(Math.round(sharpness * circlemult)).keys()].forEach(x => {
        const rad = (45 - x * 1.5) * scalemult;
        const weight = 0.5 / x;
        geomGroup.add(circle(centerpoint, rad, { stroke: "aquamarine", fill: "#232323", weight: weight * weightmult }));
      });
      const pts = distributeOnRadius(45 * scalemult, Math.round(sharpness * circlemult) * 5, 0);
      pts.forEach(p => {
        geomGroup.add(line(centerpoint, add2([], p, centerpoint), { stroke: "aquamarine", weight: 0.5 * weightmult }));
      })
      if (object["scope"] instanceof String) {

        sharpness = calcTextSharpness(object["scope"] as string);
        geomGroup.add(circle(centerpoint, 1 + (sharpness * 29) * scalemult, { stroke: "aquamarine", fill: "#232323", weight: 0.5 * weightmult }));
      } else {
        generateGeomRecurse(object["scope"] as Record<string, string | unknown>, geomGroup, circlemult, scalemult * 0.8, weightmult * 0.8, centerpoint);
      }
    }
  }

  function generateGeom(circlemult: number = 3) {
    const funcGeom = group({}, []);

    generateGeomRecurse(parseRes.data, funcGeom, circlemult, 1, 1, vec2(50, 50));

    const svgtxt = asSvg(svgDoc({ viewBox: "0 0 100 100", height: "50%", width: "50%" }, funcGeom));
    // console.log(svgtxt);
    if (svgContRef.current) {
      svgContRef.current!.innerHTML = svgtxt;
    }
  }

  return (
    <>
      <h1>Magic Circle Creator</h1>
      <div className="card">
        <div className="btnContainer">

          <button onClick={() => inpRef.current!.value += "λ"}>insert λ</button>
          <button onClick={() => parseInput()}>Parse</button>
          <button onClick={() => generateGeom()}>Generate</button>
        </div>
        <input ref={inpRef} type='text' width="100%" />
        <h2>{parseRes.string}</h2>
        <div ref={svgContRef} className="svgContainer">

        </div>
      </div>
    </>
  )
}

export default App
