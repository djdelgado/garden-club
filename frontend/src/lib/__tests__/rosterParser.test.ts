import { rowsFromTable, parseRosterFile, MAX_IMPORT_ROWS } from "@/lib/rosterParser";

describe("rowsFromTable", () => {
  it("maps aliased headers case-insensitively and reports unknown columns", () => {
    const parsed = rowsFromTable([
      ["Full Name", "E-MAIL", "phone_number", "Mailing Address", "Plot #"],
      ["Ann Smith", "ann@x.org", "555-1111", "1 Elm St", "12"],
    ]);
    expect(parsed.rows).toEqual([
      { name: "Ann Smith", email: "ann@x.org", phone: "555-1111", address: "1 Elm St" },
    ]);
    expect(parsed.mapped).toEqual(["name", "email", "phone", "address"]);
    expect(parsed.unrecognized).toEqual(["Plot #"]);
  });

  it("drops fully blank rows and omits blank cells", () => {
    const parsed = rowsFromTable([
      ["Name", "Email", "Phone"],
      ["", null, "  "],
      ["Bob", "", "555"],
    ]);
    expect(parsed.rows).toEqual([{ name: "Bob", phone: "555" }]);
  });

  it("uses the first non-blank column when two map to one field", () => {
    const parsed = rowsFromTable([
      ["Name", "Phone", "Mobile"],
      ["Ann", "", "555-0001"],
      ["Bob", "555-0002", "555-9999"],
    ]);
    expect(parsed.rows.map((r) => r.phone)).toEqual(["555-0001", "555-0002"]);
  });

  it("stringifies numeric cells and trims whitespace", () => {
    const parsed = rowsFromTable([["Name", "Phone"], ["  Ann  ", 5551111]]);
    expect(parsed.rows).toEqual([{ name: "Ann", phone: "5551111" }]);
  });

  it("rejects a sheet with no Name or Email header", () => {
    expect(() => rowsFromTable([["Plot", "Dues"], ["1", "yes"]])).toThrow(/Name.*Email/);
  });

  it("accepts an Email-only sheet", () => {
    expect(rowsFromTable([["Email"], ["a@x.org"]]).rows).toEqual([{ email: "a@x.org" }]);
  });

  it(`rejects more than ${MAX_IMPORT_ROWS} data rows`, () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`P${i}`]);
    expect(() => rowsFromTable([["Name"], ...body])).toThrow(/limit is 1000/);
  });
});

describe("parseRosterFile", () => {
  const file = (name: string, text: string, type = "") => new File([text], name, { type });

  it("parses a CSV, including quoted commas", async () => {
    const parsed = await parseRosterFile(
      file("roster.csv", 'Name,Address\nAnn,"1 Elm St, Apt 2"\n\n', "text/csv")
    );
    expect(parsed.rows).toEqual([{ name: "Ann", address: "1 Elm St, Apt 2" }]);
  });

  it("explains that legacy .xls is unsupported", async () => {
    await expect(parseRosterFile(file("old.xls", "x"))).rejects.toThrow(/\.xls files aren't supported/);
  });

  it("rejects other file types", async () => {
    await expect(parseRosterFile(file("notes.txt", "x"))).rejects.toThrow(/\.xlsx or \.csv/);
  });
});
