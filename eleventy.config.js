import { HtmlBasePlugin } from "@11ty/eleventy";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export default function (config) {
  const apps = JSON.parse(
    readFileSync(new URL("./src/_data/apps.json", import.meta.url), "utf8"),
  );
  const validId = (value) =>
    typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const slugs = new Set();
  for (const app of apps) {
    if (!validId(app.slug) || slugs.has(app.slug))
      throw new Error("Every app needs a unique, URL-safe slug.");
    slugs.add(app.slug);
    for (const field of ["name", "summary", "supportEmail"])
      if (!app[field]) throw new Error("Missing app field: " + field);
    if (app.icon ? !existsSync(resolve("src" + app.icon)) : !app.initials)
      throw new Error("App needs an existing icon or initials: " + app.slug);
    if (
      app.preview &&
      (!app.previewAlt || !existsSync(resolve("src" + app.preview)))
    )
      throw new Error("App preview needs an image and alt text: " + app.slug);
    if (!Array.isArray(app.platforms) || !app.platforms.length)
      throw new Error("App needs at least one platform: " + app.slug);
    const ids = new Set();
    for (const platform of app.platforms) {
      if (!validId(platform.id) || ids.has(platform.id) || !platform.name)
        throw new Error("Platform needs a unique id and name: " + app.slug);
      ids.add(platform.id);
      if (!["Available", "In development", "Planned"].includes(platform.status))
        throw new Error("Unknown platform status: " + platform.id);
      if (
        platform.status === "Available" &&
        (!platform.storeLinks?.length || !platform.privacyPolicies?.length)
      )
        throw new Error(
          "Available platforms need actual store and privacy links: " +
            app.slug +
            "/" +
            platform.id,
        );
      for (const link of platform.storeLinks ?? [])
        if (!link.label || !link.url?.startsWith("https://"))
          throw new Error("Store links need a label and HTTPS URL.");
      for (const policy of platform.privacyPolicies ?? []) {
        if (
          !policy.label ||
          !(
            policy.url?.startsWith("https://") ||
            policy.url?.startsWith("/apps/" + app.slug + "/")
          )
        )
          throw new Error(
            "Privacy policies need an app-specific page or HTTPS URL.",
          );
        if (
          !policy.url.startsWith("https://") &&
          (!policy.file || !existsSync(resolve("src/policies", policy.file)))
        )
          throw new Error(
            "Local policy source file is missing: " +
              app.slug +
              "/" +
              platform.id,
          );
      }
    }
  }
  config.addPlugin(HtmlBasePlugin);
  config.addPassthroughCopy("src/assets");
  config.addFilter("findApp", (list, slug) => {
    const app = list.find((app) => app.slug === slug);
    if (!app) throw new Error("Unknown app policy slug: " + slug);
    return app;
  });
  config.addFilter("policyPlatforms", (platforms, ids) => {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => !platforms.some((platform) => platform.id === id))
    )
      throw new Error("Policy must name its actual platform scope.");
    return platforms.filter((platform) => ids.includes(platform.id));
  });
  config.addFilter("readableDate", (value) =>
    new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value)),
  );
  config.addGlobalData("year", new Date().getUTCFullYear());
  const supplied = process.env.ELEVENTY_PATH_PREFIX || "/";
  const pathPrefix =
    "/" +
    supplied.split("/").filter(Boolean).join("/") +
    (supplied === "/" ? "" : "/");
  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    templateFormats: ["md", "njk"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix,
  };
}
