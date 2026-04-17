import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';

const DEFAULT_ICON_GROUP_ID = 101;
const DEFAULT_LANG = 1033;
const DEFAULT_CODEPAGE = 1200;

function parseWindowsVersion(version) {
  const parts = `${version ?? '0.0.0.0'}`
    .split('.')
    .map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? Math.max(0, Math.min(65535, value)) : 0;
    });

  while (parts.length < 4) {
    parts.push(0);
  }

  return parts.slice(0, 4);
}

function getPrimaryLanguage(versionInfoList) {
  const firstVersionInfo = versionInfoList[0];
  const firstTranslation =
    firstVersionInfo?.getAllLanguagesForStringValues()[0] ??
    firstVersionInfo?.getAvailableLanguages()[0];

  return firstTranslation ?? { lang: DEFAULT_LANG, codepage: DEFAULT_CODEPAGE };
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const executablePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  const iconPath = path.join(context.packager.projectDir, 'assets', 'icon', 'app-icon.ico');

  const [exeBuffer, iconBuffer] = await Promise.all([
    readFile(executablePath),
    readFile(iconPath),
  ]);

  const executable = NtExecutable.from(exeBuffer);
  const resource = NtExecutableResource.from(executable);
  const entries = resource.entries;

  const iconGroups = Resource.IconGroupEntry.fromEntries(entries);
  const targetGroup = iconGroups[0];
  const iconGroupId = targetGroup?.id ?? DEFAULT_ICON_GROUP_ID;
  const iconLang = targetGroup?.lang ?? DEFAULT_LANG;
  const iconFile = Data.IconFile.from(iconBuffer);

  Resource.IconGroupEntry.replaceIconsForResource(
    entries,
    iconGroupId,
    iconLang,
    iconFile.icons.map((item) => item.data),
  );

  const versionInfoList = Resource.VersionInfo.fromEntries(entries);
  const versionInfo = versionInfoList[0] ?? Resource.VersionInfo.createEmpty();
  const primaryLanguage = getPrimaryLanguage(versionInfoList);
  const [major, minor, patch, revision] = parseWindowsVersion(
    context.packager.appInfo.shortVersionWindows ??
      context.packager.appInfo.shortVersion ??
      context.packager.appInfo.buildVersion,
  );

  versionInfo.lang = primaryLanguage.lang;
  versionInfo.setFileVersion(major, minor, patch, revision, primaryLanguage.lang);
  versionInfo.setProductVersion(major, minor, patch, revision, primaryLanguage.lang);

  const stringValues = {
    FileDescription: context.packager.appInfo.productName,
    ProductName: context.packager.appInfo.productName,
    FileVersion: `${major}.${minor}.${patch}.${revision}`,
    ProductVersion: `${major}.${minor}.${patch}.${revision}`,
    OriginalFilename: `${context.packager.appInfo.productFilename}.exe`,
    InternalName: context.packager.appInfo.productFilename,
    LegalCopyright: context.packager.appInfo.copyright,
  };

  if (context.packager.appInfo.companyName) {
    stringValues.CompanyName = context.packager.appInfo.companyName;
  }

  versionInfo.setStringValues(primaryLanguage, stringValues, true);
  versionInfo.outputToResourceEntries(entries);

  resource.outputResource(executable);
  await writeFile(executablePath, Buffer.from(executable.generate()));
}
