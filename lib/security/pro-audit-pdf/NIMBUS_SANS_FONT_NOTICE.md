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
