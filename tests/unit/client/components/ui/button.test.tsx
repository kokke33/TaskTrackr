import { describe, it, expect } from "vitest";
import { render, screen } from "../../../../utils/testUtils";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("should render button with text", () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("should handle click events", async () => {
    const user = userEvent.setup();
    let clicked = false;
    const handleClick = () => { clicked = true; };
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole("button");
    await user.click(button);
    
    expect(clicked).toBe(true);
  });

  it("should render different variants", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    
    let button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button variant="destructive">Destructive</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button variant="link">Link</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should render different sizes", () => {
    const { rerender } = render(<Button size="default">Default Size</Button>);
    
    let button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button size="sm">Small</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    rerender(<Button size="icon">Icon</Button>);
    button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should not call onClick when disabled", async () => {
    const user = userEvent.setup();
    let clicked = false;
    const handleClick = () => { clicked = true; };
    
    render(<Button disabled onClick={handleClick}>Disabled Button</Button>);
    
    const button = screen.getByRole("button");
    await user.click(button);
    
    expect(clicked).toBe(false);
  });

  it("should accept custom className", () => {
    render(<Button className="custom-class">Custom Button</Button>);
    
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("should render as different HTML elements", () => {
    const { rerender } = render(<Button asChild={false}>Button</Button>);
    
    let element = screen.getByRole("button");
    expect(element.tagName).toBe("BUTTON");
    
    // asChild プロパティのテストは実装に依存
    // Radix UI の Slot コンポーネントを使用している場合のテスト
  });

  it("should be focusable", () => {
    render(<Button>Focusable Button</Button>);
    
    const button = screen.getByRole("button");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("should handle keyboard navigation", async () => {
    const user = userEvent.setup();
    let activated = false;
    const handleClick = () => { activated = true; };
    
    render(<Button onClick={handleClick}>Keyboard Button</Button>);
    
    const button = screen.getByRole("button");
    button.focus();
    
    await user.keyboard("{Enter}");
    expect(activated).toBe(true);
    
    activated = false;
    await user.keyboard(" ");
    expect(activated).toBe(true);
  });
});
