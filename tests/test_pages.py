"""Basic publishing checks for the static GitHub Pages site."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import unittest


ROOT = Path(__file__).resolve().parents[1]


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append(value)


class PagesPublishingTest(unittest.TestCase):
    def test_home_and_local_assets_are_published(self):
        home = ROOT / "index.html"
        self.assertTrue(home.is_file(), "GitHub Pages needs index.html at the root")

        for page in [home, *(ROOT / "pages").glob("*.html")]:
            parser = LocalReferences()
            parser.feed(page.read_text(encoding="utf-8"))
            for reference in parser.references:
                parsed = urlsplit(reference)
                if parsed.scheme or parsed.netloc or not parsed.path:
                    continue
                target = (page.parent / unquote(parsed.path)).resolve()
                with self.subTest(page=page.name, reference=reference):
                    self.assertTrue(target.is_file(), f"Missing local file: {reference}")


if __name__ == "__main__":
    unittest.main()
