// Used only by the single-file build, where React comes from a CDN as a global
// and the automatic JSX runtime is not available. Maps jsx() onto createElement.
import React from 'react';

type Props = Record<string, unknown> & { children?: unknown };

export const Fragment = React.Fragment;

export function jsx(type: React.ElementType, props: Props, key?: React.Key) {
  const { children, ...rest } = props;
  const p = key === undefined ? rest : { ...rest, key };
  return children === undefined ? React.createElement(type, p) : React.createElement(type, p, children as React.ReactNode);
}

export const jsxs = jsx;
