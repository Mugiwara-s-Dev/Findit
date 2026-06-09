// Parseador e importador de productos desde archivos CSV.
import type { BarcodeLookupResult, ProductCategory } from "@/lib/types";

export type ProductCsvRow = {
  rowNumber: number;
  barcode: string;
  productName: string;
  brandName: string;
  productCategory: string;
  unit: string;
  price: string;
  quantityAvailable: string;
  imageDataUrl: string;
};

export type ImportedProductPayload = {
  productName: string;
  brandName: string | null;
  productCategory: ProductCategory;
  unit: string;
  barcode: string | null;
  price: number;
  quantityAvailable: number;
  imageDataUrl: string | null;
};

type ProductCategoryOption = {
  value: ProductCategory;
  label: string;
};

type ResolveImportedProductRowOptions = {
  lookupBarcode: (barcode: string) => Promise<BarcodeLookupResult>;
  productCategoryOptions: ProductCategoryOption[];
};

export function parseProductCsvRows(text: string): ProductCsvRow[] {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const trimmedText = normalizedText.trim();
  if (!trimmedText) {
    return [];
  }

  const delimiter = detectCsvDelimiter(trimmedText);
  const records = parseCsvRecords(trimmedText, delimiter);
  if (records.length < 2) {
    return [];
  }

  const headers = records[0].map((header) => normalizeCsvHeader(header));

  return records
    .slice(1)
    .filter((record) => record.some((value) => value.trim() !== ""))
    .map((record, index) => {
      const row: ProductCsvRow = {
        rowNumber: index + 2,
        barcode: "",
        productName: "",
        brandName: "",
        productCategory: "",
        unit: "",
        price: "",
        quantityAvailable: "",
        imageDataUrl: "",
      };

      headers.forEach((header, headerIndex) => {
        const value = record[headerIndex]?.trim() ?? "";
        const field = resolveCsvField(header);
        if (!field) {
          return;
        }

        switch (field) {
          case "barcode":
            row.barcode = value;
            break;
          case "productName":
            row.productName = value;
            break;
          case "brandName":
            row.brandName = value;
            break;
          case "productCategory":
            row.productCategory = value;
            break;
          case "unit":
            row.unit = value;
            break;
          case "price":
            row.price = value;
            break;
          case "quantityAvailable":
            row.quantityAvailable = value;
            break;
          case "imageDataUrl":
            row.imageDataUrl = value;
            break;
        }
      });

      return row;
    });
}

export async function resolveImportedProductRow(
  row: ProductCsvRow,
  options: ResolveImportedProductRowOptions,
): Promise<{ payload: ImportedProductPayload } | { error: string }> {
  const barcode = row.barcode.trim();
  const quantityAvailable = row.quantityAvailable.trim() ? Number.parseInt(row.quantityAvailable.trim(), 10) : 0;
  const imageDataUrl = row.imageDataUrl.trim() ? row.imageDataUrl.trim() : null;

  let lookup: BarcodeLookupResult | null = null;
  if (barcode) {
    try {
      lookup = await options.lookupBarcode(barcode);
    } catch {
      lookup = null;
    }
  }

  const productName = pickCsvOrLookup(row.productName, lookup?.productName).trim();
  const brandName = pickCsvOrLookup(row.brandName, lookup?.brandName).trim();
  const productCategory =
    parseProductCategoryFromCsv(row.productCategory, options.productCategoryOptions)
    ?? lookup?.productCategory
    ?? null;
  const unit = pickCsvOrLookup(row.unit, lookup?.unit).trim();
  const price = parseCsvMoney(row.price);

  if (!productName) {
    return { error: "falta el nombre del producto" };
  }

  if (!productCategory) {
    return { error: "falta la categoria del producto" };
  }

  if (!unit) {
    return { error: "falta la unidad o presentacion" };
  }

  if (price === null || !Number.isFinite(price) || price <= 0) {
    return { error: "el precio es invalido" };
  }

  if (row.quantityAvailable.trim() && (!Number.isInteger(quantityAvailable) || quantityAvailable < 0)) {
    return { error: "la cantidad disponible es invalida" };
  }

  return {
    payload: {
      productName,
      brandName: brandName || null,
      productCategory,
      unit,
      barcode: barcode || null,
      price,
      quantityAvailable,
      imageDataUrl: imageDataUrl ?? lookup?.imageDataUrl ?? null,
    },
  };
}

function detectCsvDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = countDelimiterOutsideQuotes(firstLine, ";");
  const commas = countDelimiterOutsideQuotes(firstLine, ",");

  return semicolons > commas ? ";" : ",";
}

function countDelimiterOutsideQuotes(text: string, delimiter: "," | ";") {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === delimiter) {
      count += 1;
    }
  }

  return count;
}

function parseCsvRecords(text: string, delimiter: "," | ";") {
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentCell);
      records.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  records.push(currentRow);

  return records.filter((record) => record.some((cell) => cell.trim() !== ""));
}

function normalizeCsvHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveCsvField(header: string): keyof ProductCsvRow | null {
  if (
    header.includes("barcode")
    || header.includes("ean")
    || header.includes("gtin")
    || (header.includes("codigo") && header.includes("barra"))
  ) {
    return "barcode";
  }

  if (header.includes("name") || header.includes("nombre") || header.includes("producto")) {
    return "productName";
  }

  if (header.includes("brand") || header.includes("marca")) {
    return "brandName";
  }

  if (header.includes("category") || header.includes("categoria") || header.includes("tipo")) {
    return "productCategory";
  }

  if (header.includes("unit") || header.includes("unidad") || header.includes("presentacion")) {
    return "unit";
  }

  if (header.includes("price") || header.includes("precio") || header.includes("cost")) {
    return "price";
  }

  if (header.includes("quantity") || header.includes("cantidad") || header.includes("stock")) {
    return "quantityAvailable";
  }

  if (header.includes("image")) {
    return "imageDataUrl";
  }

  return null;
}

function parseProductCategoryFromCsv(
  rawCategory: string,
  productCategoryOptions: ProductCategoryOption[],
): ProductCategory | null {
  const normalizedCategory = normalizeCsvHeader(rawCategory);
  if (!normalizedCategory) {
    return null;
  }

  const matchedOption = productCategoryOptions.find((option) => {
    const normalizedValue = normalizeCsvHeader(option.value);
    const normalizedLabel = normalizeCsvHeader(option.label);
    return normalizedValue === normalizedCategory || normalizedLabel === normalizedCategory;
  });

  if (matchedOption) {
    return matchedOption.value;
  }

  if (normalizedCategory.includes("food") || normalizedCategory.includes("alimento")) {
    return "FOOD";
  }

  if (normalizedCategory.includes("beverage") || normalizedCategory.includes("bebida")) {
    return "BEVERAGE";
  }

  if (normalizedCategory.includes("health") || normalizedCategory.includes("salud")) {
    return "HEALTH";
  }

  if (normalizedCategory.includes("home") || normalizedCategory.includes("hogar")) {
    return "HOME";
  }

  if (normalizedCategory.includes("pet")) {
    return "PETS";
  }

  if (normalizedCategory.includes("care") || normalizedCategory.includes("cuidado") || normalizedCategory.includes("personal")) {
    return "PERSONAL_CARE";
  }

  return null;
}

function parseCsvMoney(rawValue: string) {
  const value = rawValue.trim().replace(/[^0-9.,-]/g, "");
  if (!value) {
    return null;
  }

  if (value.includes(",") && value.includes(".")) {
    return Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
  }

  if (value.includes(",")) {
    return Number.parseFloat(value.replace(",", "."));
  }

  const dotCount = (value.match(/\./g) ?? []).length;
  if (dotCount > 1) {
    return Number.parseFloat(value.replace(/\./g, ""));
  }

  if (dotCount === 1) {
    const [leftPart, rightPart] = value.split(".");
    if (rightPart.length === 3 && leftPart.length > 0) {
      return Number.parseFloat(`${leftPart}${rightPart}`);
    }
  }

  return Number.parseFloat(value);
}

function pickCsvOrLookup(csvValue: string, lookupValue: string | null | undefined) {
  const trimmedCsvValue = csvValue.trim();
  if (trimmedCsvValue) {
    return trimmedCsvValue;
  }

  return (lookupValue ?? "").trim();
}
