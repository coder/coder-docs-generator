import { readFileSync } from "fs";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import path from "path";
import { serialize } from "next-mdx-remote/serialize";
import { MDXRemote } from "next-mdx-remote";
import fm from "front-matter";
import { ComponentProps } from "react";

type FilePath = string;
type UrlPath = string;
type Route = { path: FilePath; children?: Route[] };
type Manifest = { versions: string[]; routes: Route[] };

const readContentFile = (filePath: string) => {
  const baseDir = process.cwd();
  const contentPath = path.join(baseDir, "content");
  return readFileSync(path.join(contentPath, filePath), { encoding: "utf-8" });
};

const transformFilePathToUrlPath = (filePath: string) => {
  // Remove markdown extension
  let urlPath = filePath.replace(/\.md/g, "");

  // Remove relative path
  if (urlPath.startsWith("./")) {
    urlPath = urlPath.replace("./", "");
  }

  // Remove index from the root file
  if (urlPath.endsWith("index")) {
    urlPath = urlPath.replace("index", "");
  }

  // Remove index from the sub root files
  if (urlPath.endsWith("/index")) {
    urlPath = urlPath.replace("/index", "");
  }

  return urlPath;
};

const mapRoutes = (manifest: Manifest): Record<UrlPath, FilePath> => {
  let paths: Record<FilePath, UrlPath> = {};

  const addPaths = (routes: Route[]) => {
    for (const route of routes) {
      paths[transformFilePathToUrlPath(route.path)] = route.path;

      if (route.children) {
        addPaths(route.children);
      }
    }
  };

  addPaths(manifest.routes);

  return paths;
};

export const getStaticPaths: GetStaticPaths = (req) => {
  const manifestContent = readContentFile("manifest.json");
  const manifest = JSON.parse(manifestContent) as Manifest;
  const routes = mapRoutes(manifest);
  const paths = Object.keys(routes).map((urlPath) => ({
    params: { slug: urlPath.split("/") },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  // When it is home page, the slug is undefined because there is no url path
  // so we make it an empty string to work good with the mapRoutes
  const { slug = [""] } = context.params as { slug: string[] };
  const manifestContent = readContentFile("manifest.json");
  const manifest = JSON.parse(manifestContent) as Manifest;
  const routes = mapRoutes(manifest);
  const urlPath = slug.join("/");
  const filePath = routes[urlPath];
  const { body, attributes } = fm(readContentFile(filePath));
  // Serialize MDX to support custom components
  const content = await serialize(body);

  return {
    props: { content, attributes },
  };
};

const DocsPage: NextPage<{ content: ComponentProps<typeof MDXRemote> }> = ({
  content,
}) => {
  return <MDXRemote {...content} />;
};

export default DocsPage;
