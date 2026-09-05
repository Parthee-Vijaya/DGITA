import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Native controls retain explicit labels; otherwise inherit the question. */
export function labelQuestionControls(children: ReactNode, title: string): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "string") return child;
    const element = child as ReactElement<Record<string, unknown>>;
    const props = element.props;
    const control = ["input", "select", "textarea"].includes(child.type);
    const invalid = typeof props.className === "string" && props.className.split(" ").includes("invalid");
    return cloneElement(element, {
      ...(control && !props["aria-label"] && !props["aria-labelledby"] ? { "aria-label": title } : {}),
      ...(control && invalid ? { "aria-invalid": true } : {}),
      ...(props.children ? { children: labelQuestionControls(props.children as ReactNode, title) } : {}),
    });
  });
}
