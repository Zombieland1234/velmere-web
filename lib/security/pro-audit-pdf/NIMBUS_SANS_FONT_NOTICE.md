# Nimbus Sans embedded PDF font notice

The canonical customer PDF renderer embeds deterministic subsets of
`NimbusSans-Regular.otf` and `NimbusSans-Bold.otf` from URW Base35 Fonts.

- Upstream: `urw-base35-fonts`
- Upstream source: <https://github.com/ArtifexSoftware/urw-base35-fonts>
- Source package version used for the checked-in subset: `20200910-8`
- Copyright: 2015 URW Software; 2013-2014 (URW)++ Design & Development
- License: GNU Affero General Public License version 3 with the font exception

Font exception supplied by the upstream package:

> As a special exception, permission is granted to include these font
> programs in a Postscript or PDF file that consists of a document that
> contains text to be displayed or printed using this font, regardless of the
> conditions or license applying to the document itself.

The renderer stores zlib-compressed CFF subset data in
`embedded-font-data.ts`. The subset contains printable ASCII, Latin-1, Polish
letters and Euro. It is decoded directly into the PDF FontFile3 streams; the
runtime does not depend on an operating-system font installation.

The complete AGPL-3.0 license text is available from the upstream repository
at `COPYING` and at <https://www.gnu.org/licenses/agpl-3.0.txt>.


## C13 source-packaging boundary

**CONFIRMED** — the full Git checkout tracks both `lib/security/pro-audit-pdf/embedded-font-data.ts` and `r7-runtime/external-assets/manrope-pdf-latin-plus-ext.ttf`. The C13 source exporter deliberately excludes both with reason `FONT_RESOURCE_NOT_REDISTRIBUTED`; therefore `VELMERE_SOURCE_C13.zip` is not byte-complete relative to Git.

**CONFIRMED** — `customer-safe-renderer.ts` imports the embedded Nimbus CFF constants from `embedded-font-data.ts`. Older PASS36 font-boundary records that describe an external runtime font apply only to their recorded policy scope and must not be used to claim that the current Git tree contains no embedded font data.
