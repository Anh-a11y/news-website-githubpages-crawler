(function () {
  "use strict";

  const MENU_URL = "categories.json";
  const POSTS_URL = "posts.json";
  const POSTS_KEY = "news_posts_v1";
  const MENU_KEY = "news_menu_v1";
  // GitHub Pages không chạy server.js; ảnh Dân Trí cần proxy qua Render.
  const RENDER_API_BASE = "https://news-website-githubpages-crawler.onrender.com";

  // Loại ảnh dự phòng dùng chung từ phiên bản cũ để tránh ảnh bị lặp.
  const OLD_FALLBACK_IMAGE_MARKER =
    "photo-1504711434969-e33886168f5c";

  let menu = [];
  let flatCategories = [];
  let allPosts = [];
  let currentCategory = "all";
  let currentSearch = "";

  const $ = (selector) => document.querySelector(selector);

  function flattenMenu(items, parentTitle = "") {
    const flattened = [];

    (items || []).forEach((item) => {
      const entry = { ...item, parentTitle };
      flattened.push(entry);

      if (Array.isArray(item.children)) {
        flattened.push(...flattenMenu(item.children, item.title));
      }
    });

    return flattened;
  }

  async function getJson(url) {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(
        `Không tải được ${url} (HTTP ${response.status})`
      );
    }

    return response.json();
  }

  function safeReadStoredPosts() {
    try {
      const saved = localStorage.getItem(POSTS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn(
        "LocalStorage posts không đọc được; sẽ dùng dữ liệu mẫu.",
        error
      );
      return null;
    }
  }

  function normalizeImageUrl(value) {
    let url = "";

    if (typeof value === "string") {
      url = value.trim();
    } else if (value && typeof value === "object") {
      const nested =
        value.url || value.contentUrl || value.src || "";

      url = typeof nested === "string" ? nested.trim() : "";
    }

    // Bỏ URL ảnh dự phòng chung được lưu từ phiên bản cũ.
    if (url.includes(OLD_FALLBACK_IMAGE_MARKER)) {
      return "";
    }

    return url;
  }

  function normalizePost(post) {
    const category = Array.isArray(post.category)
      ? post.category.join(" / ")
      : (post.category || "Chưa phân loại");

    return {
      id: String(
        post.id || makeId(post.url || post.title || "news")
      ),

      title: String(post.title || "Chưa có tiêu đề"),

      slug: String(
        post.slug || slugify(post.title || "bai-viet")
      ),

      excerpt: String(post.excerpt || ""),
      content: String(post.content || post.excerpt || ""),

      author:
        typeof post.author === "object" &&
        post.author !== null
          ? String(post.author.name || "Chưa rõ tác giả")
          : String(post.author || "Chưa rõ tác giả"),

      category: String(category),
      categoryId: String(post.categoryId || ""),
      categoryPath: String(post.categoryPath || ""),
      publishedAt: String(post.publishedAt || ""),
      source: String(post.source || "dantri.com.vn"),
      url: String(post.url || ""),

      image: normalizeImageUrl(
        post.image || post.imageUrl
      ),

      isSample: Boolean(post.isSample)
    };
  }

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function makeId(value) {
    const text = String(value);
    let hash = 0;

    for (let i = 0; i < text.length; i += 1) {
      hash =
        ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    return `news-${Math.abs(hash)}`;
  }

  function stableKey(post) {
    if (post.url) {
      return `url:${post.url.split("#")[0].replace(/\/$/, "")}`;
    }

    if (post.slug) {
      return `slug:${post.slug}|${post.category}`;
    }

    return `title:${post.title}|${post.category}`;
  }

  async function loadData() {
    const [menuJson, seedPosts] = await Promise.all([
      getJson(MENU_URL),
      getJson(POSTS_URL)
    ]);

    menu = Array.isArray(menuJson.menu)
      ? menuJson.menu
      : [];

    flatCategories = flattenMenu(menu);

    try {
      localStorage.setItem(
        MENU_KEY,
        JSON.stringify(menu)
      );
    } catch (_) {
      // Trình duyệt có thể chặn LocalStorage.
    }

    const saved = safeReadStoredPosts();

    const seedNormalized = (
      Array.isArray(seedPosts) ? seedPosts : []
    ).map(normalizePost);

    const savedNormalized = (
      Array.isArray(saved) ? saved : []
    ).map(normalizePost);

    // Hợp nhất theo URL/slug để tránh trùng một bài viết.
    const merged = new Map();

    seedNormalized.forEach((post) => {
      merged.set(stableKey(post), post);
    });

    savedNormalized.forEach((post) => {
      const key = stableKey(post);
      const seedPost = merged.get(key);

      merged.set(key, {
        ...(seedPost || {}),
        ...post,

        // Chỉ giữ ảnh của chính bài trùng khóa.
        // Không tạo ảnh dự phòng chung cho các bài không có ảnh.
        image: post.image || (seedPost ? seedPost.image : "")
      });
    });

    allPosts = [...merged.values()];

    try {
      localStorage.setItem(
        POSTS_KEY,
        JSON.stringify(allPosts)
      );
    } catch (_) {
      // Bỏ qua nếu LocalStorage không khả dụng.
    }
  }

  function descendantsTitles(item) {
    const titles = [item.title];

    (item.children || []).forEach((child) => {
      titles.push(...descendantsTitles(child));
    });

    return titles;
  }

  function renderNavbar() {
    const host = $("#navbar");
    if (!host) return;

    host.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "nav-inner";

    menu.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "nav-item";

      const hasChildren =
        Array.isArray(item.children) &&
        item.children.length > 0;

      const link = document.createElement("a");
      link.className = "nav-link";
      link.textContent = item.title;

      link.href =
        item.type === "external"
          ? item.url
          : `?category=${encodeURIComponent(item.id)}`;

      if (item.type === "external") {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.addEventListener("click", (event) => {
          event.preventDefault();

          currentCategory =
            item.id === "home" || item.id === "latest"
              ? "all"
              : item.id;

          const params = new URLSearchParams();

          if (currentCategory !== "all") {
            params.set("category", currentCategory);
          }

          const newUrl =
            window.location.pathname +
            (params.size ? `?${params.toString()}` : "");

          window.history.replaceState({}, "", newUrl);

          renderNavbar();
          renderPosts();

          const heading = $("#page-title");

          if (heading) {
            heading.textContent =
              item.id === "latest"
                ? "Mới nhất"
                : item.id === "home"
                  ? "Tin tức nổi bật"
                  : item.title;
          }
        });
      }

      const isCurrent =
        currentCategory === item.id ||
        (
          (item.id === "home" || item.id === "latest") &&
          currentCategory === "all"
        );

      if (isCurrent) {
        link.classList.add("active");
      }

      wrapper.appendChild(link);

      if (hasChildren) {
        const toggle = document.createElement("button");

        toggle.type = "button";
        toggle.className = "dropdown-toggle";
        toggle.textContent = "▾";

        toggle.setAttribute(
          "aria-label",
          `Mở danh mục con của ${item.title}`
        );

        toggle.setAttribute("aria-expanded", "false");

        toggle.addEventListener("click", () => {
          const willOpen =
            !wrapper.classList.contains("dropdown-open");

          inner
            .querySelectorAll(".nav-item.dropdown-open")
            .forEach((openItem) => {
              openItem.classList.remove("dropdown-open");

              const openToggle =
                openItem.querySelector(".dropdown-toggle");

              if (openToggle) {
                openToggle.setAttribute(
                  "aria-expanded",
                  "false"
                );
              }
            });

          if (willOpen) {
            wrapper.classList.add("dropdown-open");
          }

          toggle.setAttribute(
            "aria-expanded",
            String(willOpen)
          );
        });

        wrapper.appendChild(toggle);

        const dropdown = document.createElement("div");
        dropdown.className = "dropdown-menu";

        item.children.forEach((child) => {
          const sub = document.createElement("a");

          sub.href =
            `?category=${encodeURIComponent(child.id)}`;

          sub.textContent = child.title;

          if (currentCategory === child.id) {
            sub.classList.add("active");
          }

          sub.addEventListener("click", (event) => {
            event.preventDefault();

            currentCategory = child.id;

            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}?category=${encodeURIComponent(child.id)}`
            );

            renderNavbar();
            renderPosts();

            const heading = $("#page-title");

            if (heading) {
              heading.textContent = child.title;
            }
          });

          dropdown.appendChild(sub);
        });

        wrapper.appendChild(dropdown);
      }

      inner.appendChild(wrapper);
    });

    host.appendChild(inner);
  }

  function postMatchesCategory(post, categoryId) {
    if (
      !categoryId ||
      categoryId === "all" ||
      categoryId === "latest" ||
      categoryId === "home"
    ) {
      return true;
    }

    const selected = flatCategories.find(
      (item) => item.id === categoryId
    );

    if (!selected) return true;

    const terms = descendantsTitles(selected).map(
      (text) => text.toLocaleLowerCase("vi-VN")
    );

    const categoryValue = String(post.category || "")
      .toLocaleLowerCase("vi-VN");

    const postCategoryId = String(post.categoryId || "")
      .toLowerCase();

    const postCategoryPath = String(post.categoryPath || "")
      .toLocaleLowerCase("vi-VN");

    return (
      terms.some(
        (term) =>
          categoryValue.includes(term) ||
          postCategoryPath.includes(term)
      ) ||
      postCategoryId === categoryId
    );
  }

  // Chỉ hiển thị ảnh thật của bài viết.
  // Không có URL ảnh hoặc ảnh tải lỗi thì ẩn phần tử ảnh.
 
function createImage(post) {
  const originalImage = normalizeImageUrl(
    post.image || post.imageUrl
  );

  if (!originalImage) return null;

  let displayUrl;

  try {
    const imageUrl = new URL(
      originalImage,
      window.location.href
    );

    if (
      imageUrl.hostname.toLowerCase() ===
      "cdnphoto.dantri.com.vn"
    ) {
      // Khi chạy trên GitHub Pages, gọi API trên Render.
      // Khi chạy qua localhost hoặc chính Render, dùng cùng origin.
      const isGitHubPages = /(^|\.)github\.io$/i.test(
        window.location.hostname
      );
      const apiBase = isGitHubPages ? RENDER_API_BASE : "";
      displayUrl =
        `${apiBase}/api/image?url=${encodeURIComponent(imageUrl.href)}` +
        `&referer=${encodeURIComponent(
          post.url || "https://dantri.com.vn/"
        )}`;
    } else {
      displayUrl = imageUrl.href;
    }
  } catch (_) {
    return null;
  }

  const image = document.createElement("img");
  image.className = "post-image";
  image.alt = post.title || "Ảnh bài viết";
  image.loading = "lazy";
  image.src = displayUrl;

  image.onerror = () => image.remove();

  return image;
}


  function createPostCard(post, variant = "list") {
    const article = document.createElement("article");

    article.className =
      variant === "featured"
        ? "post-card featured-card"
        : "post-card list-card";

    const image = createImage(post);

    if (image) {
      article.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "post-card-content";

    const category = document.createElement("span");
    category.className = "post-tag";
    category.textContent = post.category || "Tin tức";

    const title = document.createElement("h3");

    const articleUrl =
      `pages/article.html?id=${encodeURIComponent(post.id)}`;

    const titleLink = document.createElement("a");

    titleLink.className = "post-title-link";
    titleLink.href = articleUrl;
    titleLink.textContent = post.title;

    title.appendChild(titleLink);

    const excerpt = document.createElement("p");

    excerpt.className = "post-excerpt";
    excerpt.textContent =
      post.excerpt || "Đọc bài viết để xem nội dung chi tiết.";

    const meta = document.createElement("p");
    meta.className = "post-meta";

    const parsedDate = post.publishedAt
      ? new Date(post.publishedAt)
      : null;

    const dateText =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toLocaleString("vi-VN")
        : "Chưa rõ thời gian";

    meta.textContent =
      `${post.author || "Chưa rõ tác giả"} · ${dateText}`;

    const readMore = document.createElement("a");

    readMore.className = "read-more";
    readMore.href = articleUrl;
    readMore.textContent = "Đọc chi tiết →";

    content.append(
      category,
      title,
      excerpt,
      meta,
      readMore
    );

    article.appendChild(content);

    article.classList.add("clickable-card");
    article.setAttribute("tabindex", "0");
    article.setAttribute(
      "aria-label",
      `Mở bài viết: ${post.title}`
    );

    article.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input")) {
        return;
      }

      window.location.href = articleUrl;
    });

    article.addEventListener("keydown", (event) => {
      if (
        (event.key === "Enter" || event.key === " ") &&
        event.target === article
      ) {
        event.preventDefault();
        window.location.href = articleUrl;
      }
    });

    return article;
  }

  function renderPosts() {
    const featuredHost = $("#featured-posts");
    const listHost = $("#posts-container");

    if (!featuredHost || !listHost) return;

    featuredHost.innerHTML = "";
    listHost.innerHTML = "";

    const search = currentSearch
      .trim()
      .toLocaleLowerCase("vi-VN");

    let filtered = allPosts.filter(
      (post) => postMatchesCategory(post, currentCategory)
    );

    if (search) {
      filtered = filtered.filter((post) =>
        `${post.title} ${post.excerpt} ${post.content}`
          .toLocaleLowerCase("vi-VN")
          .includes(search)
      );
    }

    filtered.sort((a, b) => {
      const timeA = Date.parse(a.publishedAt) || 0;
      const timeB = Date.parse(b.publishedAt) || 0;
      return timeB - timeA;
    });

    const featured = filtered.slice(0, 3);
    const remaining = filtered.slice(3);

    featured.forEach((post) => {
      featuredHost.appendChild(
        createPostCard(post, "featured")
      );
    });

    remaining.forEach((post) => {
      listHost.appendChild(
        createPostCard(post, "list")
      );
    });

    const featuredCount = $("#featured-count");
    const latestCount = $("#latest-count");

    if (featuredCount) {
      featuredCount.textContent = `${featured.length} bài`;
    }

    if (latestCount) {
      latestCount.textContent = `${remaining.length} bài`;
    }

    if (!filtered.length) {
      featuredHost.innerHTML =
        '<p class="empty-state">Chưa có bài viết phù hợp. Hãy crawl thêm tin ở trang Crawler.</p>';

      listHost.innerHTML =
        '<p class="empty-state">Danh sách bài viết đang trống.</p>';
    } else if (!remaining.length) {
      listHost.innerHTML =
        '<p class="empty-state">Chưa có bài viết khác ngoài 3 tin nổi bật. Hãy dùng Crawler để thu thập thêm bài.</p>';
    }

    const notice = $("#data-notice");

    if (notice) {
      const sampleOnly =
        allPosts.length > 0 &&
        allPosts.every(
          (post) =>
            post.isSample ||
            post.source === "Dữ liệu mẫu"
        );

      notice.hidden = !sampleOnly;

      notice.textContent = sampleOnly
        ? "Đây là dữ liệu mẫu để kiểm tra giao diện, chưa đáp ứng yêu cầu 10 bài cho mỗi chuyên mục. Dùng Crawler tin tức để lấy dữ liệu thực."
        : "";
    }
  }

  function setupSearch() {
    const input = $("#search-input");
    const button = $("#search-button");

    if (!input || !button) return;

    const runSearch = () => {
      currentSearch = input.value;
      renderPosts();
    };

    button.addEventListener("click", runSearch);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        runSearch();
      }
    });

    input.addEventListener("search", runSearch);
  }

  async function init() {
    try {
      await loadData();

      const params = new URLSearchParams(
        window.location.search
      );

      const fromUrl = params.get("category");

      if (fromUrl) {
        const foundById = flatCategories.find(
          (item) => item.id === fromUrl
        );

        const foundByTitle = flatCategories.find(
          (item) => item.title === fromUrl
        );

        if (foundById) {
          currentCategory = foundById.id;
        } else if (foundByTitle) {
          currentCategory = foundByTitle.id;
        }
      }

      renderNavbar();
      renderPosts();
      setupSearch();

      console.log("Website đã khởi chạy.", {
        categories: flatCategories.length,
        posts: allPosts.length
      });
    } catch (error) {
      console.error(error);

      const featured = $("#featured-posts");

      if (featured) {
        featured.innerHTML =
          '<p class="empty-state">Không tải được dữ liệu. Hãy chạy website bằng node server.js rồi mở http://localhost:3000.</p>';
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();