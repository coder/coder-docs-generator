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
type NavItem = { title: string; path: UrlPath; children?: NavItem[] };
type Nav = NavItem[];
type FmAttributes = { title: string };

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

const getNavigation = (manifest: Manifest): Nav => {
  let nav: Nav = [];

  const getNavItem = (route: Route): NavItem => {
    const { attributes } = fm<FmAttributes>(readContentFile(route.path));
    const navItem: NavItem = {
      title: attributes.title,
      path: transformFilePathToUrlPath(route.path),
    };

    if (route.children) {
      navItem.children = [];

      for (const childRoute of route.children) {
        navItem.children.push(getNavItem(childRoute));
      }
    }

    return navItem;
  };

  for (const route of manifest.routes) {
    nav.push(getNavItem(route));
  }

  return nav;
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
  const navigation = getNavigation(manifest);

  return {
    props: { content, attributes, navigation },
  };
};

const SidebarNavItem: React.FC<{ item: NavItem }> = ({ item }) => {
  return (
    <div>
      <a href="">{item.title}</a>

      {item.children &&
        item.children.map((subItem) => (
          <SidebarNavItem key={subItem.path} item={subItem} />
        ))}
    </div>
  );
};

const SidebarNav: React.FC<{ nav: Nav }> = ({ nav }) => {
  return (
    <div>
      {nav.map((navItem) => (
        <SidebarNavItem key={navItem.path} item={navItem} />
      ))}
    </div>
  );
};

const DocsPage: NextPage<{
  content: ComponentProps<typeof MDXRemote>;
  navigation: Nav;
}> = ({ content, navigation }) => {
  return (
    <>
      <SidebarNav nav={navigation} />
      <MDXRemote {...content} />
    </>
  );
};

export default DocsPage;
