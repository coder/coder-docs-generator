import { readFileSync } from "fs";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import path from "path";
import fm from "front-matter";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/router";

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

  // Remove trailing slash
  if (urlPath.endsWith("/")) {
    urlPath = urlPath.replace(/\/+$/, "");
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

let manifest: Manifest;

const getManifest = () => {
  if (manifest) {
    return manifest;
  }

  const manifestContent = readContentFile("manifest.json");
  manifest = JSON.parse(manifestContent) as Manifest;
  return manifest;
};

let navigation: Nav;

const getNavigation = (manifest: Manifest): Nav => {
  if (navigation) {
    return navigation;
  }

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

  navigation = [];

  for (const route of manifest.routes) {
    navigation.push(getNavItem(route));
  }

  return navigation;
};

const removeHtmlComments = (string: string) => {
  return string.replace(/<!--[\s\S]*?-->/g, "");
};

export const getStaticPaths: GetStaticPaths = () => {
  const manifest = getManifest();
  const routes = mapRoutes(manifest);
  const paths = Object.keys(routes).map((urlPath) => ({
    params: { slug: urlPath.split("/") },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = (context) => {
  // When it is home page, the slug is undefined because there is no url path
  // so we make it an empty string to work good with the mapRoutes
  const { slug = [""] } = context.params as { slug: string[] };
  const manifest = getManifest();
  const routes = mapRoutes(manifest);
  const urlPath = slug.join("/");
  const filePath = routes[urlPath];
  const { body, attributes } = fm(readContentFile(filePath));
  // Serialize MDX to support custom components
  const content = removeHtmlComments(body);
  const navigation = getNavigation(manifest);

  return {
    props: { content, attributes, navigation },
  };
};

const SidebarNavItem: React.FC<{ item: NavItem }> = ({ item }) => {
  return (
    <div>
      <a href={"/" + item.path}>{item.title}</a>

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
  content: string;
  navigation: Nav;
}> = ({ content, navigation }) => {
  return (
    <div>
      <SidebarNav nav={navigation}></SidebarNav>
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
    </div>
  );
};

export default DocsPage;
