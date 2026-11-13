import { FONT_ROLES } from "../layout/fontRoles.ts";

export const UI_FONT_FAMILY = "Liberation Sans";
export const UI_FONT_RESOURCES = [
  {
    key: FONT_ROLES.body,
    role: "body",
    style: "normal",
    url: "/art/fonts/liberation/LiberationSans-Regular.ttf",
    weight: "400",
  },
  {
    key: FONT_ROLES.heading,
    role: "heading",
    style: "normal",
    url: "/art/fonts/liberation/LiberationSans-Bold.ttf",
    weight: "700",
  },
] as const;
