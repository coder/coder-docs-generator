import { readFileSync } from "fs";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import path from "path";
import fm from "front-matter";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  Heading,
  Grid,
  Box,
  Link,
  Img,
  Text,
  UnorderedList,
  OrderedList,
  Code,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import _ from "lodash";
import Head from "next/head";

type FilePath = string;
type UrlPath = string;
type Route = { path: FilePath; children?: Route[] };
type Manifest = { versions: string[]; routes: Route[] };
type NavItem = { title: string; path: UrlPath; children?: NavItem[] };
type Nav = NavItem[];
type FmAttributes = { title: string; description?: string };

const readContentFile = (filePath: string) => {
  const baseDir = process.cwd();
  const contentPath = path.join(baseDir, "content");
  return readFileSync(path.join(contentPath, filePath), { encoding: "utf-8" });
};

const removeTrailingSlash = (path: string) => path.replace(/\/+$/, "");

const removeMkdExtension = (path: string) => path.replace(/\.md/g, "");

const removeIndexFilename = (path: string) => {
  if (path.endsWith("index")) {
    path = path.replace("index", "");
  }

  return path;
};

const transformFilePathToUrlPath = (filePath: string) => {
  // Remove markdown extension
  let urlPath = removeMkdExtension(filePath);

  // Remove relative path
  if (urlPath.startsWith("./")) {
    urlPath = urlPath.replace("./", "");
  }

  // Remove index from the root file
  urlPath = removeIndexFilename(urlPath);

  // Remove trailing slash
  if (urlPath.endsWith("/")) {
    urlPath = removeTrailingSlash(urlPath);
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

  const getNavItem = (route: Route, parentPath?: UrlPath): NavItem => {
    const { attributes } = fm<FmAttributes>(readContentFile(route.path));
    const path = parentPath
      ? `${parentPath}/${transformFilePathToUrlPath(route.path)}`
      : transformFilePathToUrlPath(route.path);
    const navItem: NavItem = {
      title: attributes.title,
      path,
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
  const version = manifest.versions[0];

  return {
    props: { content, attributes, navigation, version },
  };
};

const SidebarNavItem: React.FC<{ item: NavItem }> = ({ item }) => {
  const router = useRouter();
  const isActive = router.asPath.startsWith(`/${item.path}`);

  return (
    <Box>
      <NextLink href={"/" + item.path} passHref>
        <Link
          fontWeight={isActive ? 600 : 400}
          color={isActive ? "gray.900" : "gray.700"}
        >
          {item.title}
        </Link>
      </NextLink>

      {isActive && item.children && (
        <Grid
          as="nav"
          pt={2}
          pl={3}
          maxW="sm"
          autoFlow="row"
          gap={2}
          autoRows="min-content"
        >
          {item.children.map((subItem) => (
            <SidebarNavItem key={subItem.path} item={subItem} />
          ))}
        </Grid>
      )}
    </Box>
  );
};

const SidebarNav: React.FC<{ nav: Nav; version: string }> = ({
  nav,
  version,
}) => {
  return (
    <Grid
      h="100vh"
      overflowY="scroll"
      as="nav"
      p={8}
      w="300px"
      autoFlow="row"
      gap={2}
      autoRows="min-content"
      bgColor="white"
      borderRightWidth={1}
      borderColor="gray.200"
      borderStyle="solid"
    >
      <Box mb={6}>
        <Img src="/logo.svg" alt="Coder logo" />
        <Box fontWeight={500} fontSize="sm" color="gray.600" mt={2}>
          {version}
        </Box>
      </Box>

      {nav.map((navItem) => (
        <SidebarNavItem key={navItem.path} item={navItem} />
      ))}
    </Grid>
  );
};

const slugifyTitle = (title: string) => {
  return _.kebabCase(title.toLowerCase());
};

const DocsPage: NextPage<{
  content: string;
  navigation: Nav;
  attributes: FmAttributes;
  version: string;
}> = ({ content, navigation, attributes, version }) => {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{attributes.title}</title>
      </Head>
      <Grid templateColumns="max-content 1fr" fontSize="md" color="gray.700">
        <SidebarNav nav={navigation} version={version} />
        <Box
          as="main"
          w="full"
          pb={20}
          px={10}
          pl={20}
          h="100vh"
          overflowY="auto"
        >
          <Box maxW="872">
            <Box as="header" py={10}>
              <Heading as="h1" fontSize="4xl">
                {attributes.title}
              </Heading>
              {attributes.description && (
                <Box mt={1} color="gray.600">
                  {attributes.description}
                </Box>
              )}
            </Box>

            <Box lineHeight="tall">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ children }) => (
                    <Heading
                      as="h1"
                      fontSize="4xl"
                      pt={10}
                      pb={2}
                      id={slugifyTitle(children[0] as string)}
                    >
                      {children}
                    </Heading>
                  ),
                  h2: ({ children }) => (
                    <Heading
                      as="h2"
                      fontSize="3xl"
                      pt={10}
                      pb={2}
                      id={slugifyTitle(children[0] as string)}
                    >
                      {children}
                    </Heading>
                  ),
                  h3: ({ children }) => (
                    <Heading
                      as="h3"
                      fontSize="2xl"
                      pt={10}
                      pb={2}
                      id={slugifyTitle(children[0] as string)}
                    >
                      {children}
                    </Heading>
                  ),
                  img: ({ node, ...props }) => (
                    <Img
                      {...props}
                      src={`/${props.src}`}
                      mb={2}
                      borderWidth={1}
                      borderColor="gray.200"
                      borderStyle="solid"
                      rounded="md"
                    />
                  ),
                  p: ({ node, ...props }) => <Text {...props} pt={2} pb={2} />,
                  ul: ({ node, ...props }) => (
                    <UnorderedList
                      mb={4}
                      display="grid"
                      gridAutoFlow="row"
                      gap={2}
                      {...props}
                    />
                  ),
                  ol: ({ node, ...props }) => (
                    <OrderedList
                      mb={4}
                      display="grid"
                      gridAutoFlow="row"
                      gap={2}
                      {...props}
                    />
                  ),
                  a: ({ children, href = "" }) => {
                    const isExternal =
                      href.startsWith("http") || href.startsWith("https");

                    if (!isExternal) {
                      href = removeMkdExtension(href);
                      href = removeIndexFilename(href);
                      let basePath = router.asPath;
                      // We want to remove old fragment references
                      basePath = basePath.split("#")[0];
                      href = basePath + "../" + href;
                    }

                    return (
                      <NextLink href={href} passHref>
                        <Link
                          target={isExternal ? "_blank" : undefined}
                          fontWeight={500}
                          color="blue.600"
                        >
                          {children}
                        </Link>
                      </NextLink>
                    );
                  },
                  code: ({ node, ...props }) => (
                    <Code {...props} bgColor="gray.100" />
                  ),
                  pre: ({ children }) => (
                    <Box
                      as="pre"
                      w="full"
                      sx={{ "& > code": { w: "full", p: 4, rounded: "md" } }}
                      mb={2}
                    >
                      {children}
                    </Box>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </Box>
          </Box>
        </Box>
      </Grid>
    </>
  );
};

export default DocsPage;
